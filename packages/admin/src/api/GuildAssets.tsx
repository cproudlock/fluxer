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

/** @jsxRuntime automatic */
/** @jsxImportSource hono/jsx */

import {ApiClient, type ApiResult} from '@fluxer/admin/src/api/Client';
import type {Session} from '@fluxer/admin/src/types/App';
import type {AdminConfig as Config} from '@fluxer/admin/src/types/Config';
import type {ListGuildEmojisResponse, ListGuildStickersResponse} from '@fluxer/schema/src/domains/admin/AdminSchemas';
import type {GuildSoundboardSoundListResponse} from '@fluxer/schema/src/domains/guild/GuildSoundboardSchemas';

export async function listGuildSoundboardSounds(
	config: Config,
	session: Session,
	guild_id: string,
): Promise<ApiResult<GuildSoundboardSoundListResponse>> {
	const client = new ApiClient(config, session);
	return client.get<GuildSoundboardSoundListResponse>(`/admin/guilds/${guild_id}/soundboard`);
}

export async function deleteGuildSoundboardSound(
	config: Config,
	session: Session,
	guild_id: string,
	sound_id: string,
): Promise<ApiResult<void>> {
	const client = new ApiClient(config, session);
	return client.delete<void>(`/admin/guilds/${guild_id}/soundboard/${sound_id}`);
}

export async function listGuildEmojis(
	config: Config,
	session: Session,
	guild_id: string,
): Promise<ApiResult<ListGuildEmojisResponse>> {
	const client = new ApiClient(config, session);
	return client.get<ListGuildEmojisResponse>(`/admin/guilds/${guild_id}/emojis`);
}

export async function listGuildStickers(
	config: Config,
	session: Session,
	guild_id: string,
): Promise<ApiResult<ListGuildStickersResponse>> {
	const client = new ApiClient(config, session);
	return client.get<ListGuildStickersResponse>(`/admin/guilds/${guild_id}/stickers`);
}
