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

export interface GuildScheduledEventRow {
	guild_id: GuildID;
	event_id: ScheduledEventID;
	name: string;
	description: string | null;
	scheduled_start_time: Date;
	scheduled_end_time: Date | null;
	entity_type: number;
	status: number;
	channel_id: ChannelID | null;
	location: string | null;
	cover_image: string | null;
	creator_id: UserID;
	user_count: number;
	created_at: Date;
}

export const GUILD_SCHEDULED_EVENT_COLUMNS = [
	'guild_id',
	'event_id',
	'name',
	'description',
	'scheduled_start_time',
	'scheduled_end_time',
	'entity_type',
	'status',
	'channel_id',
	'location',
	'cover_image',
	'creator_id',
	'user_count',
	'created_at',
] as const satisfies ReadonlyArray<keyof GuildScheduledEventRow>;

export interface GuildScheduledEventUserRow {
	guild_id: GuildID;
	event_id: ScheduledEventID;
	user_id: UserID;
	created_at: Date;
}

export const GUILD_SCHEDULED_EVENT_USER_COLUMNS = [
	'guild_id',
	'event_id',
	'user_id',
	'created_at',
] as const satisfies ReadonlyArray<keyof GuildScheduledEventUserRow>;
