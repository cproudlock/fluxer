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

import {Endpoints} from '@app/Endpoints';
import http from '@app/lib/HttpClient';
import {Logger} from '@app/lib/Logger';
import type {SoundboardSound} from '@app/stores/SoundboardStore';
import SoundboardStore from '@app/stores/SoundboardStore';

const logger = new Logger('Soundboard');

export async function fetchSounds(guildId: string): Promise<void> {
	try {
		SoundboardStore.setLoading(true);
		const response = await http.get<Array<SoundboardSound>>({url: Endpoints.GUILD_SOUNDBOARD(guildId)});
		SoundboardStore.setSounds(guildId, response.body);
		logger.debug(`Fetched ${response.body.length} sounds for guild ${guildId}`);
	} catch (error) {
		logger.error(`Failed to fetch sounds for guild ${guildId}:`, error);
		throw error;
	} finally {
		SoundboardStore.setLoading(false);
	}
}

export async function createSound(
	guildId: string,
	params: {name: string; emoji?: string | null; volume?: number; file: File},
): Promise<SoundboardSound> {
	try {
		const response = await http.post<SoundboardSound>({
			url: Endpoints.GUILD_SOUNDBOARD(guildId),
			attachments: [{name: 'file', file: params.file, filename: params.file.name}],
			fields: [
				{name: 'name', value: params.name},
				...(params.emoji ? [{name: 'emoji', value: params.emoji}] : []),
				...(params.volume !== undefined ? [{name: 'volume', value: String(params.volume)}] : []),
			],
		});
		SoundboardStore.addSound(guildId, response.body);
		logger.debug(`Created sound "${params.name}" in guild ${guildId}`);
		return response.body;
	} catch (error) {
		logger.error(`Failed to create sound in guild ${guildId}:`, error);
		throw error;
	}
}

export async function updateSound(
	guildId: string,
	soundId: string,
	params: {name?: string; emoji?: string | null; volume?: number},
): Promise<void> {
	try {
		const response = await http.patch<SoundboardSound>({
			url: Endpoints.GUILD_SOUNDBOARD_SOUND(guildId, soundId),
			body: params,
		});
		SoundboardStore.updateSound(guildId, soundId, response.body);
		logger.debug(`Updated sound ${soundId} in guild ${guildId}`);
	} catch (error) {
		logger.error(`Failed to update sound ${soundId} in guild ${guildId}:`, error);
		throw error;
	}
}

export async function deleteSound(guildId: string, soundId: string): Promise<void> {
	try {
		await http.delete({url: Endpoints.GUILD_SOUNDBOARD_SOUND(guildId, soundId)});
		SoundboardStore.removeSound(guildId, soundId);
		logger.debug(`Deleted sound ${soundId} from guild ${guildId}`);
	} catch (error) {
		logger.error(`Failed to delete sound ${soundId} from guild ${guildId}:`, error);
		throw error;
	}
}

export async function playSound(guildId: string, soundId: string, channelId: string): Promise<void> {
	try {
		await http.post({
			url: Endpoints.GUILD_SOUNDBOARD_PLAY(guildId),
			body: {sound_id: soundId, channel_id: channelId},
		});
		logger.debug(`Played sound ${soundId} in channel ${channelId}`);
	} catch (error) {
		logger.error(`Failed to play sound ${soundId}:`, error);
		throw error;
	}
}

export function togglePanel(): void {
	SoundboardStore.togglePanel();
}

export function closePanel(): void {
	SoundboardStore.closePanel();
}
