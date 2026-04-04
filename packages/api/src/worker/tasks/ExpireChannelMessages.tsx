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

import type {GuildID, MessageID} from '@fluxer/api/src/BrandedTypes';
import {createMessageID} from '@fluxer/api/src/BrandedTypes';
import {purgeMessageAttachments} from '@fluxer/api/src/channel/services/message/MessageHelpers';
import {getMetricsService} from '@fluxer/api/src/infrastructure/MetricsService';
import {Logger} from '@fluxer/api/src/Logger';
import type {Channel} from '@fluxer/api/src/models/Channel';
import type {Message} from '@fluxer/api/src/models/Message';
import {ChannelEventDispatcher} from '@fluxer/api/src/worker/services/ChannelEventDispatcher';
import {chunkArray} from '@fluxer/api/src/worker/tasks/utils/MessageDeletion';
import {getWorkerDependencies} from '@fluxer/api/src/worker/WorkerContext';
import {ChannelTypes} from '@fluxer/constants/src/ChannelConstants';
import {createSnowflakeFromTimestamp} from '@fluxer/snowflake/src/Snowflake';
import type {WorkerTaskHandler} from '@fluxer/worker/src/contracts/WorkerTask';

const BATCH_SIZE = 100;
const MAX_DELETIONS_PER_CHANNEL = 1000;
const GUILD_PAGE_SIZE = 100;

async function processChannelRetention(channel: Channel): Promise<number> {
	if (channel.messageRetentionSeconds <= 0) return 0;

	const {channelRepository, storageService, purgeQueue, gatewayService} = getWorkerDependencies();
	const eventDispatcher = new ChannelEventDispatcher({gatewayService});

	const cutoffTimestamp = Date.now() - channel.messageRetentionSeconds * 1000;
	const cutoffSnowflake = createMessageID(createSnowflakeFromTimestamp(cutoffTimestamp));

	let totalDeleted = 0;
	let beforeMessageId: MessageID | undefined = cutoffSnowflake;

	while (totalDeleted < MAX_DELETIONS_PER_CHANNEL) {
		const messages = await channelRepository.messages.listMessages(channel.id, beforeMessageId, BATCH_SIZE);

		if (messages.length === 0) break;

		const batches = chunkArray(messages, BATCH_SIZE);
		for (const batch of batches) {
			if (totalDeleted >= MAX_DELETIONS_PER_CHANNEL) break;

			const messageIds = batch.map((m: Message) => m.id);

			await Promise.all(
				batch.map((message: Message) => purgeMessageAttachments(message, storageService, purgeQueue)),
			);

			await channelRepository.messages.bulkDeleteMessages(channel.id, messageIds);
			await eventDispatcher.dispatchBulkDelete(channel, messageIds);

			totalDeleted += batch.length;
		}

		if (messages.length < BATCH_SIZE) break;
		beforeMessageId = messages[messages.length - 1]!.id;
	}

	return totalDeleted;
}

export async function processExpireChannelMessages(): Promise<void> {
	const {guildRepository, channelRepository} = getWorkerDependencies();
	const metrics = getMetricsService();

	let totalDeleted = 0;
	let channelsProcessed = 0;
	let lastGuildId: GuildID | undefined;

	while (true) {
		const guilds = await guildRepository.listAllGuildsPaginated(GUILD_PAGE_SIZE, lastGuildId);
		if (guilds.length === 0) break;

		for (const guild of guilds) {
			const channels = await channelRepository.channelData.listGuildChannels(guild.id);
			const retentionChannels = channels.filter(
				(ch: Channel) => ch.type === ChannelTypes.GUILD_TEXT && ch.messageRetentionSeconds > 0,
			);

			for (const channel of retentionChannels) {
				try {
					const deleted = await processChannelRetention(channel);
					if (deleted > 0) {
						totalDeleted += deleted;
						channelsProcessed++;
						metrics.counter({
							name: 'fluxer.message_retention.deleted',
							dimensions: {
								guild_id: guild.id.toString(),
								channel_id: channel.id.toString(),
							},
							value: deleted,
						});
					}
				} catch (error) {
					Logger.error(
						{
							error,
							guildId: guild.id.toString(),
							channelId: channel.id.toString(),
							retentionSeconds: channel.messageRetentionSeconds,
						},
						'Failed to process message retention for channel',
					);
				}
			}
		}

		lastGuildId = guilds[guilds.length - 1]!.id;
	}

	Logger.info(
		{
			totalDeleted,
			channelsProcessed,
		},
		'Processed channel message retention',
	);
}

const expireChannelMessages: WorkerTaskHandler = async () => {
	await processExpireChannelMessages();
};

export default expireChannelMessages;
