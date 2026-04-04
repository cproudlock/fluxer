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

import type {GuildID, ScheduledEventID, UserID} from '@fluxer/api/src/BrandedTypes';
import {Db, deleteOneOrMany, fetchMany, fetchOne, upsertOne} from '@fluxer/api/src/database/Cassandra';
import type {GuildScheduledEventRow, GuildScheduledEventUserRow} from '@fluxer/api/src/database/types/ScheduledEventTypes';
import {GuildScheduledEvents, GuildScheduledEventUsers} from '@fluxer/api/src/Tables';

const FETCH_EVENTS_BY_GUILD = GuildScheduledEvents.selectCql({
	where: GuildScheduledEvents.where.eq('guild_id'),
});

const FETCH_EVENT_BY_ID = GuildScheduledEvents.selectCql({
	where: [GuildScheduledEvents.where.eq('guild_id'), GuildScheduledEvents.where.eq('event_id')],
});

const FETCH_EVENT_USERS = GuildScheduledEventUsers.selectCql({
	where: [GuildScheduledEventUsers.where.eq('guild_id'), GuildScheduledEventUsers.where.eq('event_id')],
});

const FETCH_EVENT_USER = GuildScheduledEventUsers.selectCql({
	where: [
		GuildScheduledEventUsers.where.eq('guild_id'),
		GuildScheduledEventUsers.where.eq('event_id'),
		GuildScheduledEventUsers.where.eq('user_id'),
	],
});

const COUNT_EVENTS_BY_GUILD_CQL = GuildScheduledEvents.selectCountCql({
	where: GuildScheduledEvents.where.eq('guild_id'),
});

export class ScheduledEventRepository {
	async listByGuild(guildId: GuildID): Promise<Array<GuildScheduledEventRow>> {
		return fetchMany<GuildScheduledEventRow>(FETCH_EVENTS_BY_GUILD, {guild_id: guildId});
	}

	async findById(guildId: GuildID, eventId: ScheduledEventID): Promise<GuildScheduledEventRow | null> {
		return fetchOne<GuildScheduledEventRow>(FETCH_EVENT_BY_ID, {guild_id: guildId, event_id: eventId});
	}

	async create(row: GuildScheduledEventRow): Promise<void> {
		await upsertOne(GuildScheduledEvents.insert(row));
	}

	async update(
		guildId: GuildID,
		eventId: ScheduledEventID,
		patch: Partial<Pick<GuildScheduledEventRow, 'name' | 'description' | 'scheduled_start_time' | 'scheduled_end_time' | 'entity_type' | 'status' | 'channel_id' | 'location' | 'cover_image' | 'user_count'>>,
	): Promise<void> {
		const dbPatch: Record<string, ReturnType<typeof Db.set>> = {};
		if (patch.name !== undefined) dbPatch.name = Db.set(patch.name);
		if (patch.description !== undefined) dbPatch.description = Db.set(patch.description);
		if (patch.scheduled_start_time !== undefined) dbPatch.scheduled_start_time = Db.set(patch.scheduled_start_time);
		if (patch.scheduled_end_time !== undefined) dbPatch.scheduled_end_time = Db.set(patch.scheduled_end_time);
		if (patch.entity_type !== undefined) dbPatch.entity_type = Db.set(patch.entity_type);
		if (patch.status !== undefined) dbPatch.status = Db.set(patch.status);
		if (patch.channel_id !== undefined) dbPatch.channel_id = Db.set(patch.channel_id);
		if (patch.location !== undefined) dbPatch.location = Db.set(patch.location);
		if (patch.cover_image !== undefined) dbPatch.cover_image = Db.set(patch.cover_image);
		if (patch.user_count !== undefined) dbPatch.user_count = Db.set(patch.user_count);
		await upsertOne(GuildScheduledEvents.patchByPk({guild_id: guildId, event_id: eventId}, dbPatch));
	}

	async delete(guildId: GuildID, eventId: ScheduledEventID): Promise<void> {
		await deleteOneOrMany(GuildScheduledEvents.deleteByPk({guild_id: guildId, event_id: eventId}));
	}

	async countByGuild(guildId: GuildID): Promise<number> {
		const result = await fetchOne<{count: bigint}>(COUNT_EVENTS_BY_GUILD_CQL, {guild_id: guildId});
		return result ? Number(result.count) : 0;
	}

	async listUsers(guildId: GuildID, eventId: ScheduledEventID): Promise<Array<GuildScheduledEventUserRow>> {
		return fetchMany<GuildScheduledEventUserRow>(FETCH_EVENT_USERS, {guild_id: guildId, event_id: eventId});
	}

	async findUser(guildId: GuildID, eventId: ScheduledEventID, userId: UserID): Promise<GuildScheduledEventUserRow | null> {
		return fetchOne<GuildScheduledEventUserRow>(FETCH_EVENT_USER, {guild_id: guildId, event_id: eventId, user_id: userId});
	}

	async addUser(row: GuildScheduledEventUserRow): Promise<void> {
		await upsertOne(GuildScheduledEventUsers.insert(row));
	}

	async removeUser(guildId: GuildID, eventId: ScheduledEventID, userId: UserID): Promise<void> {
		await deleteOneOrMany(GuildScheduledEventUsers.deleteByPk({guild_id: guildId, event_id: eventId, user_id: userId}));
	}
}
