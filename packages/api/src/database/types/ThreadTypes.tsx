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

export interface ThreadMemberRow {
	thread_id: ChannelID;
	user_id: UserID;
	join_timestamp: Date;
	flags: number;
}

export const THREAD_MEMBER_COLUMNS = [
	'thread_id',
	'user_id',
	'join_timestamp',
	'flags',
] as const satisfies ReadonlyArray<keyof ThreadMemberRow>;

export interface ThreadMemberByUserRow {
	user_id: UserID;
	thread_id: ChannelID;
	join_timestamp: Date;
}

export const THREAD_MEMBER_BY_USER_COLUMNS = [
	'user_id',
	'thread_id',
	'join_timestamp',
] as const satisfies ReadonlyArray<keyof ThreadMemberByUserRow>;

export interface ActiveThreadByGuildRow {
	guild_id: GuildID;
	thread_id: ChannelID;
	parent_id: ChannelID;
	created_at: Date;
}

export const ACTIVE_THREAD_BY_GUILD_COLUMNS = [
	'guild_id',
	'thread_id',
	'parent_id',
	'created_at',
] as const satisfies ReadonlyArray<keyof ActiveThreadByGuildRow>;
