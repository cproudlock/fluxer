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

import type {GuildID} from '@fluxer/api/src/BrandedTypes';
import {fetchMany, fetchOne} from '@fluxer/api/src/database/Cassandra';
import type {ActiveThreadByGuildRow} from '@fluxer/api/src/database/types/ThreadTypes';
import {Logger} from '@fluxer/api/src/Logger';
import {ActiveThreadsByGuild} from '@fluxer/api/src/Tables';
import {getWorkerDependencies} from '@fluxer/api/src/worker/WorkerContext';
import type {WorkerTaskHandler} from '@fluxer/worker/src/contracts/WorkerTask';

const GUILD_PAGE_SIZE = 100;

const FETCH_ACTIVE_THREADS_BY_GUILD = ActiveThreadsByGuild.select({
	where: ActiveThreadsByGuild.where.eq('guild_id'),
});

const archiveThreads: WorkerTaskHandler = async () => {
	const {channelRepository, guildRepository, gatewayService} = getWorkerDependencies();
	const now = Date.now();
	let archivedCount = 0;
	let lastGuildId: GuildID | undefined;

	while (true) {
		const guilds = await guildRepository.listAllGuildsPaginated(GUILD_PAGE_SIZE, lastGuildId);
		if (guilds.length === 0) break;

		for (const guild of guilds) {
			const activeThreads = await fetchMany<ActiveThreadByGuildRow>(
				FETCH_ACTIVE_THREADS_BY_GUILD.bind({guild_id: guild.id}),
			);

			for (const threadRow of activeThreads) {
				const thread = await channelRepository.channelData.findUnique(threadRow.thread_id);
				if (!thread || !thread.isThread()) continue;
				if (thread.threadArchived) continue;

				const archiveTimestamp = thread.threadArchiveTimestamp?.getTime() ?? 0;
				const duration = thread.threadAutoArchiveDuration ?? 1440;
				if (duration === 0) continue; // 0 = never auto-archive
				const durationMs = duration * 60 * 1000;
				const expiresAt = archiveTimestamp + durationMs;

				if (now >= expiresAt) {
					const updatedRow = thread.toRow();
					updatedRow.thread_archived = true;
					updatedRow.thread_archive_timestamp = new Date();

					await channelRepository.channelData.upsert(updatedRow);

					await fetchOne(
						ActiveThreadsByGuild.deleteByPk({
							guild_id: guild.id,
							thread_id: threadRow.thread_id,
						}),
					);

					await gatewayService.dispatchGuild({
						guildId: guild.id,
						event: 'THREAD_UPDATE',
						data: {
							id: thread.id.toString(),
							guild_id: guild.id.toString(),
							parent_id: thread.parentId?.toString(),
							type: thread.type,
							name: thread.name,
							thread_metadata: {
								archived: true,
								auto_archive_duration: thread.threadAutoArchiveDuration,
								archive_timestamp: new Date().toISOString(),
								locked: thread.threadLocked,
								invitable: thread.threadInvitable,
							},
						},
					});

					archivedCount++;
				}
			}
		}

		lastGuildId = guilds[guilds.length - 1]!.id;
		if (guilds.length < GUILD_PAGE_SIZE) break;
	}

	if (archivedCount > 0) {
		Logger.info({archivedCount}, 'ArchiveThreads: archived expired threads');
	}
};

export default archiveThreads;
