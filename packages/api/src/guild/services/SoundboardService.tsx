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

import type {ChannelID, GuildID, SoundID, UserID} from '@fluxer/api/src/BrandedTypes';
import {createSoundID} from '@fluxer/api/src/BrandedTypes';
import {Config} from '@fluxer/api/src/Config';
import type {GuildSoundboardSoundRow} from '@fluxer/api/src/database/types/SoundboardTypes';
import type {SoundboardRepository} from '@fluxer/api/src/guild/repositories/SoundboardRepository';
import type {IGatewayService} from '@fluxer/api/src/infrastructure/IGatewayService';
import type {IStorageService} from '@fluxer/api/src/infrastructure/IStorageService';
import type {SnowflakeService} from '@fluxer/api/src/infrastructure/SnowflakeService';
import {requirePermission} from '@fluxer/api/src/utils/PermissionUtils';
import {Permissions} from '@fluxer/constants/src/ChannelConstants';
import {InputValidationError} from '@fluxer/errors/src/domains/core/InputValidationError';
import type {GuildSoundboardSoundResponse} from '@fluxer/schema/src/domains/guild/GuildSoundboardSchemas';

const MAX_SOUNDS_PER_GUILD = 24;
const MAX_FILE_SIZE = 1024 * 1024; // 1MB
const MAX_DURATION_MS = 5000; // 5 seconds
const ALLOWED_CONTENT_TYPES = new Set(['audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/webm', 'audio/mp4']);

function makeSoundboardKey(guildId: GuildID, soundId: SoundID, ext: string): string {
	return `soundboard/${guildId}/${soundId}.${ext}`;
}

function rowToResponse(row: GuildSoundboardSoundRow): GuildSoundboardSoundResponse {
	return {
		id: String(row.sound_id),
		guild_id: String(row.guild_id),
		name: row.name,
		emoji: row.emoji,
		volume: row.volume,
		duration_ms: row.duration_ms,
		uploaded_by: String(row.uploaded_by),
		created_at: row.created_at.toISOString(),
	};
}

export class SoundboardService {
	constructor(
		private readonly repository: SoundboardRepository,
		private readonly storageService: IStorageService,
		private readonly snowflakeService: SnowflakeService,
		private readonly gatewayService: IGatewayService,
	) {}

	async listSounds(params: {
		userId: UserID;
		guildId: GuildID;
	}): Promise<Array<GuildSoundboardSoundResponse>> {
		await requirePermission(this.gatewayService, {
			guildId: params.guildId,
			userId: params.userId,
			permission: Permissions.SPEAK,
		});
		const rows = await this.repository.listByGuild(params.guildId);
		return rows.map(rowToResponse);
	}

	async createSound(params: {
		userId: UserID;
		guildId: GuildID;
		name: string;
		emoji?: string | null;
		volume: number;
		file: File;
	}): Promise<GuildSoundboardSoundResponse> {
		await requirePermission(this.gatewayService, {
			guildId: params.guildId,
			userId: params.userId,
			permission: Permissions.MANAGE_GUILD,
		});

		const count = await this.repository.countByGuild(params.guildId);
		if (count >= MAX_SOUNDS_PER_GUILD) {
			throw InputValidationError.create('name', `Maximum of ${MAX_SOUNDS_PER_GUILD} sounds per guild`);
		}

		const file = params.file;
		if (file.size > MAX_FILE_SIZE) {
			throw InputValidationError.create('file', 'File must be 1MB or smaller');
		}

		if (!ALLOWED_CONTENT_TYPES.has(file.type)) {
			throw InputValidationError.create('file', 'File must be an audio file (mp3, ogg, wav, webm, mp4)');
		}

		const fileData = new Uint8Array(await file.arrayBuffer());

		// Determine file extension from content type
		const extMap: Record<string, string> = {
			'audio/mpeg': 'mp3',
			'audio/ogg': 'ogg',
			'audio/wav': 'wav',
			'audio/webm': 'webm',
			'audio/mp4': 'm4a',
		};
		const ext = extMap[file.type] ?? 'mp3';

		const soundId = createSoundID(await this.snowflakeService.generate());
		const fileKey = makeSoundboardKey(params.guildId, soundId, ext);

		await this.storageService.uploadObject({
			bucket: Config.s3.buckets.cdn,
			key: fileKey,
			body: fileData,
			contentType: file.type,
		});

		// Estimate duration from file size as a rough heuristic
		// For proper validation, the frontend should validate before upload
		const estimatedDurationMs = Math.min(Math.round((file.size / 16000) * 1000), MAX_DURATION_MS);

		const row: GuildSoundboardSoundRow = {
			guild_id: params.guildId,
			sound_id: soundId,
			name: params.name.trim(),
			emoji: params.emoji ?? null,
			volume: params.volume,
			duration_ms: estimatedDurationMs,
			uploaded_by: params.userId,
			file_key: fileKey,
			created_at: new Date(),
		};

		await this.repository.create(row);
		return rowToResponse(row);
	}

	async updateSound(params: {
		userId: UserID;
		guildId: GuildID;
		soundId: SoundID;
		name?: string;
		emoji?: string | null;
		volume?: number;
	}): Promise<GuildSoundboardSoundResponse> {
		await requirePermission(this.gatewayService, {
			guildId: params.guildId,
			userId: params.userId,
			permission: Permissions.MANAGE_GUILD,
		});

		const existing = await this.repository.findById(params.guildId, params.soundId);
		if (!existing) {
			throw InputValidationError.create('sound_id', 'Sound not found');
		}

		const patch: Partial<Pick<GuildSoundboardSoundRow, 'name' | 'emoji' | 'volume'>> = {};
		if (params.name !== undefined) patch.name = params.name.trim();
		if (params.emoji !== undefined) patch.emoji = params.emoji;
		if (params.volume !== undefined) patch.volume = params.volume;

		await this.repository.update(params.guildId, params.soundId, patch);

		return rowToResponse({
			...existing,
			...patch,
		});
	}

	async deleteSound(params: {
		userId: UserID;
		guildId: GuildID;
		soundId: SoundID;
	}): Promise<void> {
		await requirePermission(this.gatewayService, {
			guildId: params.guildId,
			userId: params.userId,
			permission: Permissions.MANAGE_GUILD,
		});

		const existing = await this.repository.findById(params.guildId, params.soundId);
		if (!existing) {
			throw InputValidationError.create('sound_id', 'Sound not found');
		}

		await this.storageService.deleteObject(Config.s3.buckets.cdn, existing.file_key);
		await this.repository.delete(params.guildId, params.soundId);
	}

	async playSound(params: {
		userId: UserID;
		guildId: GuildID;
		soundId: SoundID;
		channelId: ChannelID;
	}): Promise<void> {
		await requirePermission(this.gatewayService, {
			guildId: params.guildId,
			userId: params.userId,
			permission: Permissions.SPEAK,
			channelId: params.channelId,
		});

		const sound = await this.repository.findById(params.guildId, params.soundId);
		if (!sound) {
			throw InputValidationError.create('sound_id', 'Sound not found');
		}

		await this.gatewayService.dispatchGuild({
			guildId: params.guildId,
			event: 'GUILD_SOUNDBOARD_SOUND_PLAY',
			data: {
				guild_id: String(params.guildId),
				channel_id: String(params.channelId),
				sound_id: String(params.soundId),
				user_id: String(params.userId),
				volume: sound.volume,
				file_key: sound.file_key,
				name: sound.name,
				emoji: sound.emoji,
			},
		});
	}

	async getSoundForAudio(params: {
		userId: UserID;
		guildId: GuildID;
		soundId: SoundID;
	}): Promise<GuildSoundboardSoundRow> {
		await requirePermission(this.gatewayService, {
			guildId: params.guildId,
			userId: params.userId,
			permission: Permissions.SPEAK,
		});

		const sound = await this.repository.findById(params.guildId, params.soundId);
		if (!sound) {
			throw InputValidationError.create('sound_id', 'Sound not found');
		}
		return sound;
	}

	async listSoundsAdmin(guildId: GuildID): Promise<Array<GuildSoundboardSoundResponse>> {
		const rows = await this.repository.listByGuild(guildId);
		return rows.map(rowToResponse);
	}

	async deleteSoundAdmin(guildId: GuildID, soundId: SoundID): Promise<void> {
		const existing = await this.repository.findById(guildId, soundId);
		if (!existing) {
			throw InputValidationError.create('sound_id', 'Sound not found');
		}
		await this.storageService.deleteObject(Config.s3.buckets.cdn, existing.file_key);
		await this.repository.delete(guildId, soundId);
	}
}
