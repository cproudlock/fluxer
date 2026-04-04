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

import {createChannelID, createGuildID, createMessageID, createUserID} from '@fluxer/api/src/BrandedTypes';
import {Config} from '@fluxer/api/src/Config';
import {Logger} from '@fluxer/api/src/Logger';
import {sanitizeMentionContent, sendPlatformAwarePush, shouldThrottlePush} from '@fluxer/api/src/worker/tasks/utils/PushNotificationUtils';
import {getWorkerDependencies} from '@fluxer/api/src/worker/WorkerContext';
import {MessageNotifications} from '@fluxer/constants/src/NotificationConstants';
import type {WorkerTaskHandler} from '@fluxer/worker/src/contracts/WorkerTask';
import {z} from 'zod';

const PayloadSchema = z.object({
	channelId: z.string(),
	messageId: z.string(),
	authorId: z.string(),
	guildId: z.string(),
	mentionedUserIds: z.array(z.string()).optional(),
});

const handleGuildMessagePush: WorkerTaskHandler = async (payload, _helpers) => {
	if (!Config.fcm.enabled) return;

	const validated = PayloadSchema.parse(payload);
	const {userRepository, guildRepository, channelRepository, fcmService, pushDeviceRepository, kvClient} =
		getWorkerDependencies();

	if (!fcmService || !pushDeviceRepository) return;

	const authorId = createUserID(BigInt(validated.authorId));
	const channelId = createChannelID(BigInt(validated.channelId));
	const messageId = createMessageID(BigInt(validated.messageId));
	const guildId = createGuildID(BigInt(validated.guildId));

	const alreadyNotifiedIds = new Set(
		(validated.mentionedUserIds ?? []).map((id) => createUserID(BigInt(id))),
	);

	const message = await channelRepository.getMessage(channelId, messageId);
	if (!message) return;

	const channel = await channelRepository.findUnique(channelId);
	if (!channel) return;

	const members = await guildRepository.listMembers(guildId);
	const candidateUserIds = members
		.map((m) => m.userId)
		.filter((uid) => uid !== authorId && !alreadyNotifiedIds.has(uid));

	if (candidateUserIds.length === 0) return;

	const deviceMap = await pushDeviceRepository.getBulkPushDevices(candidateUserIds);
	const usersWithDevices = Array.from(deviceMap.keys());
	if (usersWithDevices.length === 0) return;

	const eligibleDevices: Array<import('@fluxer/api/src/models/PushDevice').PushDevice> = [];

	for (const userId of usersWithDevices) {
		const settings = await userRepository.findGuildSettings(userId, guildId);

		const mobilePush = settings?.mobilePush ?? false;
		if (!mobilePush) continue;

		if (settings?.muted) continue;

		let notificationLevel = settings?.messageNotifications ?? MessageNotifications.NULL;

		const channelOverride = settings?.channelOverrides.get(channelId);
		if (channelOverride) {
			if (channelOverride.muted) continue;
			const overrideLevel = channelOverride.messageNotifications;
			if (overrideLevel !== null && overrideLevel !== MessageNotifications.INHERIT) {
				notificationLevel = overrideLevel;
			}
		}

		if (
			notificationLevel === MessageNotifications.NULL ||
			notificationLevel === MessageNotifications.INHERIT
		) {
			notificationLevel = MessageNotifications.ALL_MESSAGES;
		}

		if (notificationLevel !== MessageNotifications.ALL_MESSAGES) continue;

		// Throttle: max 3 notifications per user per channel, reset when they read
		if (kvClient && await shouldThrottlePush(kvClient, userId.toString(), channelId.toString())) {
			continue;
		}

		const devices = deviceMap.get(userId);
		if (devices) {
			for (const device of devices) {
				eligibleDevices.push(device);
			}
		}
	}

	if (eligibleDevices.length === 0) return;

	const sanitizedContent = message.content
		? await sanitizeMentionContent(message.content, message.mentionedUserIds, userRepository)
		: null;
	const contentPreview = sanitizedContent ? sanitizedContent.substring(0, 200) : 'Sent a message';

	const author = await userRepository.findUnique(authorId);
	const authorName = author?.globalName ?? author?.username ?? 'Someone';
	const channelName = channel.name ?? '';

	try {
		await sendPlatformAwarePush(fcmService, eligibleDevices, {
			title: `${authorName} (#${channelName})`,
			body: contentPreview,
			data: {
				type: 'guild_message',
				channel_id: channelId.toString(),
				message_id: messageId.toString(),
				guild_id: guildId.toString(),
			},
		}, pushDeviceRepository);
	} catch (error) {
		Logger.error({error, channelId, guildId}, 'handleGuildMessagePush: FCM push failed (non-fatal)');
	}
};

export default handleGuildMessagePush;
