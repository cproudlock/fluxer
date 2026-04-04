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

import type {ChannelID, GuildID, ScheduledEventID, UserID} from '@fluxer/api/src/BrandedTypes';
import {createScheduledEventID} from '@fluxer/api/src/BrandedTypes';
import type {GuildScheduledEventRow} from '@fluxer/api/src/database/types/ScheduledEventTypes';
import type {ScheduledEventRepository} from '@fluxer/api/src/guild/repositories/ScheduledEventRepository';
import type {AvatarService} from '@fluxer/api/src/infrastructure/AvatarService';
import type {IGatewayService} from '@fluxer/api/src/infrastructure/IGatewayService';
import type {SnowflakeService} from '@fluxer/api/src/infrastructure/SnowflakeService';
import {requirePermission} from '@fluxer/api/src/utils/PermissionUtils';
import {Permissions} from '@fluxer/constants/src/ChannelConstants';
import {
	GuildScheduledEventEntityType,
	GuildScheduledEventStatus,
	MAX_EVENTS_PER_GUILD,
} from '@fluxer/constants/src/ScheduledEventConstants';
import {InputValidationError} from '@fluxer/errors/src/domains/core/InputValidationError';
import type {GuildScheduledEventResponse} from '@fluxer/schema/src/domains/guild/GuildScheduledEventSchemas';

function rowToResponse(row: GuildScheduledEventRow): GuildScheduledEventResponse {
	return {
		id: String(row.event_id),
		guild_id: String(row.guild_id),
		name: row.name,
		description: row.description,
		scheduled_start_time: row.scheduled_start_time.toISOString(),
		scheduled_end_time: row.scheduled_end_time?.toISOString() ?? null,
		entity_type: row.entity_type,
		status: row.status,
		channel_id: row.channel_id ? String(row.channel_id) : null,
		location: row.location,
		cover_image: row.cover_image,
		creator_id: String(row.creator_id),
		user_count: row.user_count,
		created_at: row.created_at.toISOString(),
	};
}

function autoTransitionStatus(row: GuildScheduledEventRow): GuildScheduledEventRow {
	const now = Date.now();
	if (row.status === GuildScheduledEventStatus.SCHEDULED && row.scheduled_start_time.getTime() <= now) {
		return {...row, status: GuildScheduledEventStatus.ACTIVE};
	}
	if (row.status === GuildScheduledEventStatus.ACTIVE && row.scheduled_end_time && row.scheduled_end_time.getTime() <= now) {
		return {...row, status: GuildScheduledEventStatus.COMPLETED};
	}
	return row;
}

export class ScheduledEventService {
	constructor(
		private readonly repository: ScheduledEventRepository,
		private readonly snowflakeService: SnowflakeService,
		private readonly gatewayService: IGatewayService,
		private readonly avatarService: AvatarService,
	) {}

	async listEvents(params: {userId: UserID; guildId: GuildID}): Promise<Array<GuildScheduledEventResponse>> {
		await requirePermission(this.gatewayService, {
			guildId: params.guildId,
			userId: params.userId,
			permission: Permissions.VIEW_CHANNEL,
		});
		const rows = await this.repository.listByGuild(params.guildId);
		const transitioned = rows.map(autoTransitionStatus);

		// Persist any status transitions
		for (let i = 0; i < rows.length; i++) {
			if (rows[i].status !== transitioned[i].status) {
				await this.repository.update(params.guildId, transitioned[i].event_id, {status: transitioned[i].status});
			}
		}

		return transitioned.map(rowToResponse);
	}

	async createEvent(params: {
		userId: UserID;
		guildId: GuildID;
		name: string;
		description?: string | null;
		scheduledStartTime: string;
		scheduledEndTime?: string | null;
		entityType: number;
		channelId?: ChannelID | null;
		location?: string | null;
		coverImage?: string | null;
	}): Promise<GuildScheduledEventResponse> {
		await requirePermission(this.gatewayService, {
			guildId: params.guildId,
			userId: params.userId,
			permission: Permissions.MANAGE_EVENTS,
		});

		const count = await this.repository.countByGuild(params.guildId);
		if (count >= MAX_EVENTS_PER_GUILD) {
			throw InputValidationError.create('name', `Maximum of ${MAX_EVENTS_PER_GUILD} events per guild`);
		}

		if (params.entityType === GuildScheduledEventEntityType.VOICE && !params.channelId) {
			throw InputValidationError.create('channel_id', 'Voice channel is required for voice events');
		}

		if (params.entityType === GuildScheduledEventEntityType.EXTERNAL && !params.location) {
			throw InputValidationError.create('location', 'Location is required for external events');
		}

		const eventId = createScheduledEventID(await this.snowflakeService.generate());
		const now = new Date();

		let coverImageHash: string | null = null;
		if (params.coverImage) {
			coverImageHash = await this.avatarService.uploadAvatar({
				prefix: 'banners',
				entityId: eventId,
				errorPath: 'cover_image',
				base64Image: params.coverImage,
			});
		}

		const row: GuildScheduledEventRow = {
			guild_id: params.guildId,
			event_id: eventId,
			name: params.name,
			description: params.description ?? null,
			scheduled_start_time: new Date(params.scheduledStartTime),
			scheduled_end_time: params.scheduledEndTime ? new Date(params.scheduledEndTime) : null,
			entity_type: params.entityType,
			status: GuildScheduledEventStatus.SCHEDULED,
			channel_id: params.channelId ?? null,
			location: params.location ?? null,
			cover_image: coverImageHash,
			creator_id: params.userId,
			user_count: 0,
			created_at: now,
		};

		await this.repository.create(row);

		const response = rowToResponse(row);
		await this.gatewayService.dispatchGuild({
			guildId: params.guildId,
			event: 'GUILD_SCHEDULED_EVENT_CREATE',
			data: response,
		});

		return response;
	}

	async updateEvent(params: {
		userId: UserID;
		guildId: GuildID;
		eventId: ScheduledEventID;
		name?: string;
		description?: string | null;
		scheduledStartTime?: string;
		scheduledEndTime?: string | null;
		entityType?: number;
		channelId?: ChannelID | null;
		location?: string | null;
		status?: number;
		coverImage?: string | null;
	}): Promise<GuildScheduledEventResponse> {
		await requirePermission(this.gatewayService, {
			guildId: params.guildId,
			userId: params.userId,
			permission: Permissions.MANAGE_EVENTS,
		});

		const existing = await this.repository.findById(params.guildId, params.eventId);
		if (!existing) {
			throw InputValidationError.create('event_id', 'Unknown event');
		}

		const patch: Record<string, any> = {};
		if (params.name !== undefined) patch.name = params.name;
		if (params.description !== undefined) patch.description = params.description;
		if (params.scheduledStartTime !== undefined) patch.scheduled_start_time = new Date(params.scheduledStartTime);
		if (params.scheduledEndTime !== undefined) patch.scheduled_end_time = params.scheduledEndTime ? new Date(params.scheduledEndTime) : null;
		if (params.entityType !== undefined) patch.entity_type = params.entityType;
		if (params.channelId !== undefined) patch.channel_id = params.channelId;
		if (params.location !== undefined) patch.location = params.location;
		if (params.status !== undefined) patch.status = params.status;

		if (params.coverImage !== undefined) {
			const coverImageHash = await this.avatarService.uploadAvatar({
				prefix: 'banners',
				entityId: params.eventId,
				errorPath: 'cover_image',
				previousKey: existing.cover_image,
				base64Image: params.coverImage,
			});
			patch.cover_image = coverImageHash;
		}

		await this.repository.update(params.guildId, params.eventId, patch);

		const updated = {...existing, ...patch};
		const response = rowToResponse(updated as GuildScheduledEventRow);

		await this.gatewayService.dispatchGuild({
			guildId: params.guildId,
			event: 'GUILD_SCHEDULED_EVENT_UPDATE',
			data: response,
		});

		return response;
	}

	async deleteEvent(params: {
		userId: UserID;
		guildId: GuildID;
		eventId: ScheduledEventID;
	}): Promise<void> {
		await requirePermission(this.gatewayService, {
			guildId: params.guildId,
			userId: params.userId,
			permission: Permissions.MANAGE_EVENTS,
		});

		const existing = await this.repository.findById(params.guildId, params.eventId);
		if (!existing) {
			throw InputValidationError.create('event_id', 'Unknown event');
		}

		await this.repository.delete(params.guildId, params.eventId);

		await this.gatewayService.dispatchGuild({
			guildId: params.guildId,
			event: 'GUILD_SCHEDULED_EVENT_DELETE',
			data: {id: String(params.eventId), guild_id: String(params.guildId)},
		});
	}

	async addInterested(params: {
		userId: UserID;
		guildId: GuildID;
		eventId: ScheduledEventID;
	}): Promise<void> {
		const existing = await this.repository.findById(params.guildId, params.eventId);
		if (!existing) {
			throw InputValidationError.create('event_id', 'Unknown event');
		}

		const already = await this.repository.findUser(params.guildId, params.eventId, params.userId);
		if (already) return;

		await this.repository.addUser({
			guild_id: params.guildId,
			event_id: params.eventId,
			user_id: params.userId,
			created_at: new Date(),
		});

		// Derive count from actual rows to avoid read-modify-write race
		const users = await this.repository.listUsers(params.guildId, params.eventId);
		await this.repository.update(params.guildId, params.eventId, {user_count: users.length});

		await this.gatewayService.dispatchGuild({
			guildId: params.guildId,
			event: 'GUILD_SCHEDULED_EVENT_USER_ADD',
			data: {
				guild_scheduled_event_id: String(params.eventId),
				guild_id: String(params.guildId),
				user_id: String(params.userId),
			},
		});
	}

	async removeInterested(params: {
		userId: UserID;
		guildId: GuildID;
		eventId: ScheduledEventID;
	}): Promise<void> {
		const existing = await this.repository.findById(params.guildId, params.eventId);
		if (!existing) {
			throw InputValidationError.create('event_id', 'Unknown event');
		}

		const userRow = await this.repository.findUser(params.guildId, params.eventId, params.userId);
		if (!userRow) return;

		await this.repository.removeUser(params.guildId, params.eventId, params.userId);

		// Derive count from actual rows to avoid read-modify-write race
		const users = await this.repository.listUsers(params.guildId, params.eventId);
		await this.repository.update(params.guildId, params.eventId, {user_count: users.length});

		await this.gatewayService.dispatchGuild({
			guildId: params.guildId,
			event: 'GUILD_SCHEDULED_EVENT_USER_REMOVE',
			data: {
				guild_scheduled_event_id: String(params.eventId),
				guild_id: String(params.guildId),
				user_id: String(params.userId),
			},
		});
	}

	async listInterestedUsers(params: {
		userId: UserID;
		guildId: GuildID;
		eventId: ScheduledEventID;
	}): Promise<Array<{user_id: string; event_id: string; guild_id: string}>> {
		await requirePermission(this.gatewayService, {
			guildId: params.guildId,
			userId: params.userId,
			permission: Permissions.VIEW_CHANNEL,
		});
		const users = await this.repository.listUsers(params.guildId, params.eventId);
		return users.map((u) => ({
			user_id: String(u.user_id),
			event_id: String(u.event_id),
			guild_id: String(u.guild_id),
		}));
	}
}
