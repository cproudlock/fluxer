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

import type {ChannelID, GuildID, UserID} from '@fluxer/api/src/BrandedTypes';
import {mapChannelToResponse} from '@fluxer/api/src/channel/ChannelMappers';
import type {IChannelRepositoryAggregate} from '@fluxer/api/src/channel/repositories/IChannelRepositoryAggregate';
import type {ThreadMemberRepository} from '@fluxer/api/src/channel/repositories/ThreadMemberRepository';
import type {ChannelService} from '@fluxer/api/src/channel/services/ChannelService';
import type {ChannelRow} from '@fluxer/api/src/database/types/ChannelTypes';
import type {IGatewayService} from '@fluxer/api/src/infrastructure/IGatewayService';
import type {SnowflakeService} from '@fluxer/api/src/infrastructure/SnowflakeService';
import type {UserCacheService} from '@fluxer/api/src/infrastructure/UserCacheService';
import type {RequestCache} from '@fluxer/api/src/middleware/RequestCacheMiddleware';
import {ActiveThreadsByGuild} from '@fluxer/api/src/Tables';
import {fetchOne} from '@fluxer/api/src/database/Cassandra';
import {ChannelTypes, Permissions} from '@fluxer/constants/src/ChannelConstants';
import {UnknownChannelError} from '@fluxer/errors/src/domains/channel/UnknownChannelError';
import {MissingPermissionsError} from '@fluxer/errors/src/domains/core/MissingPermissionsError';

interface ThreadServiceDeps {
	channelRepository: IChannelRepositoryAggregate;
	threadMemberRepository: ThreadMemberRepository;
	channelService: ChannelService;
	gatewayService: IGatewayService;
	snowflakeService: SnowflakeService;
	userCacheService: UserCacheService;
}

export interface CreateThreadParams {
	userId: UserID;
	channelId: ChannelID;
	name: string;
	autoArchiveDuration?: number;
	type?: number;
	appliedTags?: Array<bigint>;
	requestCache: RequestCache;
}

export interface UpdateThreadParams {
	userId: UserID;
	threadId: ChannelID;
	name?: string;
	archived?: boolean;
	autoArchiveDuration?: number;
	locked?: boolean;
	invitable?: boolean;
	rateLimitPerUser?: number;
	appliedTags?: Array<bigint>;
	requestCache: RequestCache;
}

export class ThreadService {
	constructor(private readonly deps: ThreadServiceDeps) {}

	async createThread({userId, channelId, name, autoArchiveDuration, type, appliedTags, requestCache}: CreateThreadParams) {
		const {channelService, channelRepository, threadMemberRepository, gatewayService, snowflakeService, userCacheService} = this.deps;

		const auth = await channelService.getChannelAuthenticated({userId, channelId});
		const {channel, guild, checkPermission} = auth;

		if (!guild || !channel.guildId) {
			throw new UnknownChannelError();
		}

		if (channel.type !== ChannelTypes.GUILD_TEXT && channel.type !== ChannelTypes.GUILD_FORUM) {
			throw new UnknownChannelError();
		}

		const threadType = type ?? ChannelTypes.PUBLIC_THREAD;
		if (threadType === ChannelTypes.PUBLIC_THREAD) {
			await checkPermission(Permissions.CREATE_PUBLIC_THREADS);
		} else if (threadType === ChannelTypes.PRIVATE_THREAD) {
			await checkPermission(Permissions.CREATE_PRIVATE_THREADS);
		} else {
			throw new UnknownChannelError();
		}

		const threadId = (await snowflakeService.generate()) as ChannelID;
		const now = new Date();

		const threadRow: ChannelRow = {
			channel_id: threadId,
			guild_id: channel.guildId,
			type: threadType,
			name,
			topic: null,
			icon_hash: null,
			url: null,
			parent_id: channelId,
			position: null,
			owner_id: userId,
			recipient_ids: null,
			nsfw: channel.isNsfw,
			rate_limit_per_user: channel.rateLimitPerUser,
			message_retention_seconds: channel.messageRetentionSeconds,
			bitrate: null,
			user_limit: null,
			rtc_region: null,
			last_message_id: null,
			last_pin_timestamp: null,
			permission_overwrites: null,
			nicks: null,
			soft_deleted: false,
			indexed_at: null,
			version: 0,
			thread_archived: false,
			thread_auto_archive_duration: autoArchiveDuration ?? 1440,
			thread_archive_timestamp: now,
			thread_locked: false,
			thread_invitable: threadType === ChannelTypes.PRIVATE_THREAD,
			thread_creator_id: userId,
			thread_message_count: 0,
			thread_member_count: 1,
			applied_tags: appliedTags && appliedTags.length > 0
				? JSON.stringify(appliedTags.map((t) => t.toString()))
				: null,
		};

		const threadChannel = await channelRepository.channelData.upsert(threadRow);

		await fetchOne(
			ActiveThreadsByGuild.upsertAll({
				guild_id: channel.guildId,
				thread_id: threadId,
				parent_id: channelId,
				created_at: now,
			}),
		);

		await threadMemberRepository.addMember(threadId, userId);

		const response = await mapChannelToResponse({
			channel: threadChannel,
			currentUserId: userId,
			userCacheService,
			requestCache,
		});

		await gatewayService.dispatchGuild({
			guildId: channel.guildId,
			event: 'THREAD_CREATE',
			data: response,
		});

		return response;
	}

	async updateThread({userId, threadId, name, archived, autoArchiveDuration, locked, invitable, rateLimitPerUser, appliedTags, requestCache}: UpdateThreadParams) {
		const {channelService, channelRepository, gatewayService, userCacheService} = this.deps;

		const auth = await channelService.getChannelAuthenticated({userId, channelId: threadId});
		const {channel, guild, hasPermission} = auth;

		if (!channel.isThread() || !guild || !channel.guildId) {
			throw new UnknownChannelError();
		}

		const isCreator = channel.threadCreatorId === userId;
		const canManageThreads = await hasPermission(Permissions.MANAGE_THREADS);

		if (locked !== undefined || (archived === false && channel.threadLocked)) {
			if (!canManageThreads) throw new MissingPermissionsError();
		}

		if (!isCreator && !canManageThreads) {
			throw new MissingPermissionsError();
		}

		const updatedRow = channel.toRow();
		if (name !== undefined) updatedRow.name = name;
		if (archived !== undefined) {
			updatedRow.thread_archived = archived;
			updatedRow.thread_archive_timestamp = new Date();
		}
		if (autoArchiveDuration !== undefined) updatedRow.thread_auto_archive_duration = autoArchiveDuration;
		if (locked !== undefined) updatedRow.thread_locked = locked;
		if (invitable !== undefined) updatedRow.thread_invitable = invitable;
		if (rateLimitPerUser !== undefined) updatedRow.rate_limit_per_user = rateLimitPerUser;
		if (appliedTags !== undefined) {
			updatedRow.applied_tags = appliedTags.length > 0
				? JSON.stringify(appliedTags.map((t) => t.toString()))
				: null;
		}

		const updated = await channelRepository.channelData.upsert(updatedRow);

		if (archived === true) {
			await fetchOne(
				ActiveThreadsByGuild.deleteByPk({
					guild_id: channel.guildId,
					thread_id: threadId,
				}),
			);
		} else if (archived === false) {
			await fetchOne(
				ActiveThreadsByGuild.upsertAll({
					guild_id: channel.guildId,
					thread_id: threadId,
					parent_id: channel.parentId!,
					created_at: new Date(),
				}),
			);
		}

		const response = await mapChannelToResponse({
			channel: updated,
			currentUserId: userId,
			userCacheService,
			requestCache,
		});

		await gatewayService.dispatchGuild({
			guildId: channel.guildId,
			event: 'THREAD_UPDATE',
			data: response,
		});

		return response;
	}

	async deleteThread({userId, threadId}: {userId: UserID; threadId: ChannelID}) {
		const {channelService, channelRepository, gatewayService} = this.deps;

		const auth = await channelService.getChannelAuthenticated({userId, channelId: threadId});
		const {channel, guild, checkPermission} = auth;

		if (!channel.isThread() || !guild || !channel.guildId) {
			throw new UnknownChannelError();
		}

		await checkPermission(Permissions.MANAGE_THREADS);

		await channelRepository.channelData.delete(threadId, channel.guildId);

		await fetchOne(
			ActiveThreadsByGuild.deleteByPk({
				guild_id: channel.guildId,
				thread_id: threadId,
			}),
		);

		await gatewayService.dispatchGuild({
			guildId: channel.guildId,
			event: 'THREAD_DELETE',
			data: {id: threadId.toString(), guild_id: channel.guildId.toString(), parent_id: channel.parentId?.toString()},
		});
	}

	async joinThread({userId, threadId}: {userId: UserID; threadId: ChannelID}) {
		const {channelService, threadMemberRepository, gatewayService} = this.deps;

		const auth = await channelService.getChannelAuthenticated({userId, channelId: threadId});
		const {channel, guild} = auth;

		if (!channel.isThread() || !guild || !channel.guildId) {
			throw new UnknownChannelError();
		}

		if (channel.threadArchived) {
			throw new UnknownChannelError();
		}

		const already = await threadMemberRepository.isMember(threadId, userId);
		if (already) return;

		await threadMemberRepository.addMember(threadId, userId);

		await gatewayService.dispatchGuild({
			guildId: channel.guildId,
			event: 'THREAD_MEMBERS_UPDATE',
			data: {
				id: threadId.toString(),
				guild_id: channel.guildId.toString(),
				member_count: await threadMemberRepository.getMemberCount(threadId),
				added_members: [{user_id: userId.toString(), join_timestamp: new Date().toISOString(), flags: 0}],
				removed_member_ids: [],
			},
		});
	}

	async leaveThread({userId, threadId}: {userId: UserID; threadId: ChannelID}) {
		const {channelService, threadMemberRepository, gatewayService} = this.deps;

		const auth = await channelService.getChannelAuthenticated({userId, channelId: threadId});
		const {channel, guild} = auth;

		if (!channel.isThread() || !guild || !channel.guildId) {
			throw new UnknownChannelError();
		}

		await threadMemberRepository.removeMember(threadId, userId);

		await gatewayService.dispatchGuild({
			guildId: channel.guildId,
			event: 'THREAD_MEMBERS_UPDATE',
			data: {
				id: threadId.toString(),
				guild_id: channel.guildId.toString(),
				member_count: await threadMemberRepository.getMemberCount(threadId),
				added_members: [],
				removed_member_ids: [userId.toString()],
			},
		});
	}

	async addMember({userId, threadId, targetUserId}: {userId: UserID; threadId: ChannelID; targetUserId: UserID}) {
		const {channelService, threadMemberRepository, gatewayService} = this.deps;

		const auth = await channelService.getChannelAuthenticated({userId, channelId: threadId});
		const {channel, guild, hasPermission} = auth;

		if (!channel.isThread() || !guild || !channel.guildId) {
			throw new UnknownChannelError();
		}

		if (channel.threadArchived) {
			throw new UnknownChannelError();
		}

		if (channel.isPrivateThread()) {
			const canManage = await hasPermission(Permissions.MANAGE_THREADS);
			if (!canManage && channel.threadCreatorId !== userId) {
				if (!channel.threadInvitable) {
					throw new MissingPermissionsError();
				}
			}
		}

		await threadMemberRepository.addMember(threadId, targetUserId);

		await gatewayService.dispatchGuild({
			guildId: channel.guildId,
			event: 'THREAD_MEMBERS_UPDATE',
			data: {
				id: threadId.toString(),
				guild_id: channel.guildId.toString(),
				member_count: await threadMemberRepository.getMemberCount(threadId),
				added_members: [{user_id: targetUserId.toString(), join_timestamp: new Date().toISOString(), flags: 0}],
				removed_member_ids: [],
			},
		});
	}

	async removeMember({userId, threadId, targetUserId}: {userId: UserID; threadId: ChannelID; targetUserId: UserID}) {
		const {channelService, threadMemberRepository, gatewayService} = this.deps;

		const auth = await channelService.getChannelAuthenticated({userId, channelId: threadId});
		const {channel, guild, checkPermission} = auth;

		if (!channel.isThread() || !guild || !channel.guildId) {
			throw new UnknownChannelError();
		}

		if (targetUserId !== userId) {
			await checkPermission(Permissions.MANAGE_THREADS);
		}

		await threadMemberRepository.removeMember(threadId, targetUserId);

		await gatewayService.dispatchGuild({
			guildId: channel.guildId,
			event: 'THREAD_MEMBERS_UPDATE',
			data: {
				id: threadId.toString(),
				guild_id: channel.guildId.toString(),
				member_count: await threadMemberRepository.getMemberCount(threadId),
				added_members: [],
				removed_member_ids: [targetUserId.toString()],
			},
		});
	}

	async listMembers({userId, threadId}: {userId: UserID; threadId: ChannelID}) {
		const {channelService, threadMemberRepository} = this.deps;

		const auth = await channelService.getChannelAuthenticated({userId, channelId: threadId});
		const {channel} = auth;

		if (!channel.isThread()) {
			throw new UnknownChannelError();
		}

		const members = await threadMemberRepository.listMembers(threadId);
		return members.map((m) => ({
			id: threadId.toString(),
			user_id: m.user_id.toString(),
			join_timestamp: m.join_timestamp.toISOString(),
			flags: m.flags,
		}));
	}

	async listActiveThreads({userId, guildId, requestCache}: {userId: UserID; guildId: GuildID; requestCache: RequestCache}) {
		const {channelRepository, userCacheService} = this.deps;
		const threads = await channelRepository.channelData.listActiveThreads(guildId);

		const responses = await Promise.all(
			threads.map((thread) =>
				mapChannelToResponse({
					channel: thread,
					currentUserId: userId,
					userCacheService,
					requestCache,
				}),
			),
		);

		return {threads: responses};
	}

	async listArchivedThreads({userId, channelId, requestCache}: {userId: UserID; channelId: ChannelID; requestCache: RequestCache}) {
		const {channelService, channelRepository, userCacheService} = this.deps;

		const auth = await channelService.getChannelAuthenticated({userId, channelId});
		const {channel} = auth;

		if (channel.type !== ChannelTypes.GUILD_TEXT && channel.type !== ChannelTypes.GUILD_FORUM) {
			throw new UnknownChannelError();
		}

		const threads = await channelRepository.channelData.listChannelThreads(channelId, true);

		const responses = await Promise.all(
			threads.map((thread) =>
				mapChannelToResponse({
					channel: thread,
					currentUserId: userId,
					userCacheService,
					requestCache,
				}),
			),
		);

		return {threads: responses, has_more: false};
	}

	async incrementMessageCount(threadId: ChannelID) {
		const {channelRepository} = this.deps;
		const channel = await channelRepository.channelData.findUnique(threadId);
		if (!channel || !channel.isThread()) return;

		const row = channel.toRow();
		row.thread_message_count = (channel.threadMessageCount ?? 0) + 1;
		row.thread_archive_timestamp = new Date();
		await channelRepository.channelData.upsert(row);
	}
}
