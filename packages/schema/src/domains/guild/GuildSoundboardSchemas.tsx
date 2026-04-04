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

import {SnowflakeStringType} from '@fluxer/schema/src/primitives/SchemaPrimitives';
import {z} from 'zod';

export const GuildSoundboardSoundResponse = z.object({
	id: SnowflakeStringType.describe('The unique identifier for this sound'),
	guild_id: SnowflakeStringType.describe('The guild this sound belongs to'),
	name: z.string().describe('The name of the sound'),
	emoji: z.string().nullable().describe('The emoji associated with this sound'),
	volume: z.number().describe('The default playback volume (0.0 to 1.0)'),
	duration_ms: z.number().describe('The duration of the sound in milliseconds'),
	uploaded_by: SnowflakeStringType.describe('The user who uploaded this sound'),
	created_at: z.string().describe('When this sound was created'),
});

export type GuildSoundboardSoundResponse = z.infer<typeof GuildSoundboardSoundResponse>;

export const GuildSoundboardSoundListResponse = z.array(GuildSoundboardSoundResponse);
export type GuildSoundboardSoundListResponse = z.infer<typeof GuildSoundboardSoundListResponse>;

export const GuildSoundboardCreateRequest = z.object({
	name: z.string().min(1).max(32).describe('The name of the sound'),
	emoji: z.string().max(64).nullable().optional().describe('The emoji associated with this sound'),
	volume: z.coerce.number().min(0).max(1).optional().default(0.8).describe('The default playback volume'),
});
export type GuildSoundboardCreateRequest = z.infer<typeof GuildSoundboardCreateRequest>;

export const GuildSoundboardUpdateRequest = z.object({
	name: z.string().min(1).max(32).optional().describe('The name of the sound'),
	emoji: z.string().max(64).nullable().optional().describe('The emoji associated with this sound'),
	volume: z.number().min(0).max(1).optional().describe('The default playback volume'),
});
export type GuildSoundboardUpdateRequest = z.infer<typeof GuildSoundboardUpdateRequest>;

export const GuildSoundboardPlayRequest = z.object({
	sound_id: SnowflakeStringType.describe('The ID of the sound to play'),
	channel_id: SnowflakeStringType.describe('The voice channel to play the sound in'),
});
export type GuildSoundboardPlayRequest = z.infer<typeof GuildSoundboardPlayRequest>;
