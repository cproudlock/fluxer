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

import {createChannelID, createGuildID, createSoundID} from '@fluxer/api/src/BrandedTypes';
import {LoginRequired} from '@fluxer/api/src/middleware/AuthMiddleware';
import {RateLimitMiddleware} from '@fluxer/api/src/middleware/RateLimitMiddleware';
import {OpenAPI} from '@fluxer/api/src/middleware/ResponseTypeMiddleware';
import {RateLimitConfigs} from '@fluxer/api/src/RateLimitConfig';
import type {HonoApp} from '@fluxer/api/src/types/HonoEnv';
import {Validator} from '@fluxer/api/src/Validator';
import {GuildIdParam, GuildIdSoundIdParam} from '@fluxer/schema/src/domains/common/CommonParamSchemas';
import {
	GuildSoundboardPlayRequest,
	GuildSoundboardSoundListResponse,
	GuildSoundboardSoundResponse,
	GuildSoundboardUpdateRequest,
} from '@fluxer/schema/src/domains/guild/GuildSoundboardSchemas';

export function GuildSoundboardController(app: HonoApp) {
	app.get(
		'/guilds/:guild_id/soundboard',
		RateLimitMiddleware(RateLimitConfigs.GUILD_SOUNDBOARD_LIST),
		LoginRequired,
		Validator('param', GuildIdParam),
		OpenAPI({
			operationId: 'list_guild_soundboard_sounds',
			summary: 'List guild soundboard sounds',
			description: 'List all soundboard sounds for a guild. Requires SPEAK permission.',
			responseSchema: GuildSoundboardSoundListResponse,
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Guilds'],
		}),
		async (ctx) => {
			const user = ctx.get('user');
			const guildId = createGuildID(ctx.req.valid('param').guild_id);
			const sounds = await ctx.get('soundboardService').listSounds({userId: user.id, guildId});
			return ctx.json(sounds);
		},
	);

	app.post(
		'/guilds/:guild_id/soundboard',
		RateLimitMiddleware(RateLimitConfigs.GUILD_SOUNDBOARD_CREATE),
		LoginRequired,
		Validator('param', GuildIdParam),
		OpenAPI({
			operationId: 'create_guild_soundboard_sound',
			summary: 'Upload a soundboard sound',
			description: 'Upload a new soundboard sound. Requires MANAGE_GUILD permission. Max 8 sounds per guild, 1MB per file.',
			responseSchema: GuildSoundboardSoundResponse,
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Guilds'],
		}),
		async (ctx) => {
			const user = ctx.get('user');
			const guildId = createGuildID(ctx.req.valid('param').guild_id);
			const formData = await ctx.req.formData();
			const file = formData.get('file');
			const name = formData.get('name');
			const emoji = formData.get('emoji');
			const volumeStr = formData.get('volume');

			if (!(file instanceof File)) {
				return ctx.json({message: 'Audio file is required'}, 400);
			}
			if (typeof name !== 'string' || name.length === 0 || name.length > 32) {
				return ctx.json({message: 'Name is required (1-32 characters)'}, 400);
			}

			const volume = volumeStr ? Number(volumeStr) : 0.8;

			const sound = await ctx.get('soundboardService').createSound({
				userId: user.id,
				guildId,
				name,
				emoji: typeof emoji === 'string' ? emoji : null,
				volume: Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : 0.8,
				file,
			});
			return ctx.json(sound);
		},
	);

	app.patch(
		'/guilds/:guild_id/soundboard/:sound_id',
		RateLimitMiddleware(RateLimitConfigs.GUILD_SOUNDBOARD_UPDATE),
		LoginRequired,
		Validator('param', GuildIdSoundIdParam),
		Validator('json', GuildSoundboardUpdateRequest),
		OpenAPI({
			operationId: 'update_guild_soundboard_sound',
			summary: 'Update a soundboard sound',
			description: 'Update an existing soundboard sound. Requires MANAGE_GUILD permission.',
			responseSchema: GuildSoundboardSoundResponse,
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Guilds'],
		}),
		async (ctx) => {
			const user = ctx.get('user');
			const params = ctx.req.valid('param');
			const guildId = createGuildID(params.guild_id);
			const soundId = createSoundID(params.sound_id);
			const data = ctx.req.valid('json');

			const sound = await ctx.get('soundboardService').updateSound({
				userId: user.id,
				guildId,
				soundId,
				...data,
			});
			return ctx.json(sound);
		},
	);

	app.delete(
		'/guilds/:guild_id/soundboard/:sound_id',
		RateLimitMiddleware(RateLimitConfigs.GUILD_SOUNDBOARD_DELETE),
		LoginRequired,
		Validator('param', GuildIdSoundIdParam),
		OpenAPI({
			operationId: 'delete_guild_soundboard_sound',
			summary: 'Delete a soundboard sound',
			description: 'Delete a soundboard sound and its audio file. Requires MANAGE_GUILD permission.',
			responseSchema: GuildSoundboardSoundResponse,
			statusCode: 204,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Guilds'],
		}),
		async (ctx) => {
			const user = ctx.get('user');
			const params = ctx.req.valid('param');
			const guildId = createGuildID(params.guild_id);
			const soundId = createSoundID(params.sound_id);

			await ctx.get('soundboardService').deleteSound({userId: user.id, guildId, soundId});
			return ctx.body(null, 204);
		},
	);

	app.post(
		'/guilds/:guild_id/soundboard/play',
		RateLimitMiddleware(RateLimitConfigs.GUILD_SOUNDBOARD_PLAY),
		LoginRequired,
		Validator('param', GuildIdParam),
		Validator('json', GuildSoundboardPlayRequest),
		OpenAPI({
			operationId: 'play_guild_soundboard_sound',
			summary: 'Play a soundboard sound in a voice channel',
			description: 'Triggers playback of a soundboard sound for all voice participants. Requires SPEAK permission. Rate limited to 1 per 3 seconds.',
			responseSchema: GuildSoundboardSoundResponse,
			statusCode: 204,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Guilds'],
		}),
		async (ctx) => {
			const user = ctx.get('user');
			const guildId = createGuildID(ctx.req.valid('param').guild_id);
			const {sound_id, channel_id} = ctx.req.valid('json');

			await ctx.get('soundboardService').playSound({
				userId: user.id,
				guildId,
				soundId: createSoundID(BigInt(sound_id)),
				channelId: createChannelID(BigInt(channel_id)),
			});
			return ctx.body(null, 204);
		},
	);

	app.get(
		'/guilds/:guild_id/soundboard/:sound_id/audio',
		RateLimitMiddleware(RateLimitConfigs.GUILD_SOUNDBOARD_LIST),
		LoginRequired,
		Validator('param', GuildIdSoundIdParam),
		OpenAPI({
			operationId: 'get_guild_soundboard_sound_audio',
			summary: 'Get soundboard sound audio file',
			description: 'Stream the audio file for a soundboard sound. Proxied from storage with proper CORS headers.',
			responseSchema: GuildSoundboardSoundResponse,
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Guilds'],
		}),
		async (ctx) => {
			const user = ctx.get('user');
			const params = ctx.req.valid('param');
			const guildId = createGuildID(params.guild_id);
			const soundId = createSoundID(params.sound_id);

			const sound = await ctx.get('soundboardService').getSoundForAudio({
				userId: user.id,
				guildId,
				soundId,
			});

			const storageService = ctx.get('storageService');
			const {Config} = await import('@fluxer/api/src/Config');
			const result = await storageService.streamObject({
				bucket: Config.s3.buckets.cdn,
				key: sound.file_key,
			});

			if (!result) {
				return ctx.json({message: 'Audio file not found'}, 404);
			}

			ctx.header('Content-Type', result.contentType ?? 'audio/mpeg');
			ctx.header('Content-Length', String(result.contentLength));
			ctx.header('Cache-Control', 'public, max-age=86400');
			ctx.header('Content-Disposition', 'attachment');
			ctx.header('X-Content-Type-Options', 'nosniff');

			return ctx.body(result.body as unknown as ReadableStream);
		},
	);
}
