/*
 * Copyright (C) 2026 Fluxer Contributors
 *
 * This file is part of Fluxer.
 *
 * Fluxer is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Fluxer is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with Fluxer. If not, see <https://www.gnu.org/licenses/>.
 */

import {createChannelID, createMessageID, createUserID} from '@fluxer/api/src/BrandedTypes';
import {Config} from '@fluxer/api/src/Config';
import {Logger} from '@fluxer/api/src/Logger';
import {sanitizeMentionContent, sendPlatformAwarePush, shouldThrottlePush} from '@fluxer/api/src/worker/tasks/utils/PushNotificationUtils';
import {getWorkerDependencies} from '@fluxer/api/src/worker/WorkerContext';
import type {WorkerTaskHandler} from '@fluxer/worker/src/contracts/WorkerTask';
import {z} from 'zod';

const PayloadSchema = z.object({
	channelId: z.string(),
	messageId: z.string(),
	authorId: z.string(),
});

const handleDMNotification: WorkerTaskHandler = async (payload, _helpers) => {
	const validated = PayloadSchema.parse(payload);
	Logger.info({payload: validated}, 'handleDMNotification: processing');

	if (!Config.fcm.enabled) {
		Logger.info('handleDMNotification: FCM disabled, skipping');
		return;
	}

	const {channelRepository, userRepository, fcmService, pushDeviceRepository, kvClient} = getWorkerDependencies();

	if (!fcmService || !pushDeviceRepository) {
		Logger.info('handleDMNotification: FCM service or push device repository not available');
		return;
	}

	const channelId = createChannelID(BigInt(validated.channelId));
	const messageId = createMessageID(BigInt(validated.messageId));
	const authorId = createUserID(BigInt(validated.authorId));

	const channel = await channelRepository.findUnique(channelId);
	if (!channel) {
		Logger.info({channelId}, 'handleDMNotification: Channel not found, skipping');
		return;
	}

	const message = await channelRepository.getMessage(channelId, messageId);
	if (!message) {
		Logger.info({messageId}, 'handleDMNotification: Message not found, skipping');
		return;
	}

	const recipientIds = Array.from(channel.recipientIds || []).filter((id) => id !== authorId);
	Logger.info({recipientCount: recipientIds.length, authorId}, 'handleDMNotification: recipients filtered');
	if (recipientIds.length === 0) {
		return;
	}

	const author = await userRepository.findUnique(authorId);
	const authorName = author?.globalName ?? author?.username ?? 'Someone';

	// Throttle: max 3 notifications per recipient per DM channel
	const throttledRecipientIds: Array<typeof recipientIds[0]> = [];
	for (const recipientId of recipientIds) {
		if (kvClient && await shouldThrottlePush(kvClient, recipientId.toString(), channelId.toString())) {
			continue;
		}
		throttledRecipientIds.push(recipientId);
	}
	if (throttledRecipientIds.length === 0) {
		Logger.info({channelId}, 'handleDMNotification: All recipients throttled');
		return;
	}

	const deviceMap = await pushDeviceRepository.getBulkPushDevices(throttledRecipientIds);
	const allDevices: Array<import('@fluxer/api/src/models/PushDevice').PushDevice> = [];
	for (const devices of deviceMap.values()) {
		for (const device of devices) {
			allDevices.push(device);
		}
	}

	Logger.info({tokenCount: allDevices.length}, 'handleDMNotification: FCM tokens found');
	if (allDevices.length === 0) {
		return;
	}

	const sanitizedContent = message.content
		? await sanitizeMentionContent(message.content, message.mentionedUserIds, userRepository)
		: null;
	const contentPreview = sanitizedContent ? sanitizedContent.substring(0, 200) : 'Sent a message';

	try {
		await sendPlatformAwarePush(fcmService, allDevices, {
			title: authorName,
			body: contentPreview,
			data: {
				type: 'dm',
				channel_id: channelId.toString(),
				message_id: messageId.toString(),
				author_id: authorId.toString(),
			},
		}, pushDeviceRepository);
		Logger.info({tokenCount: allDevices.length, authorName}, 'handleDMNotification: FCM sent successfully');
	} catch (error) {
		Logger.error({error, channelId}, 'handleDMNotification: FCM send failed');
	}
};

export default handleDMNotification;
