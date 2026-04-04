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
import MediaEngineStore from '@app/stores/voice/MediaEngineFacade';
import {makeAutoObservable} from 'mobx';

const logger = new Logger('SoundboardStore');

export interface SoundboardSound {
	id: string;
	guild_id: string;
	name: string;
	emoji: string | null;
	volume: number;
	duration_ms: number;
	uploaded_by: string;
	created_at: string;
}

interface SoundPlayPayload {
	guild_id: string;
	channel_id: string;
	sound_id: string;
	user_id: string;
	volume: number;
	file_key: string;
	name: string;
	emoji: string | null;
}

const audioBufferCache = new Map<string, ArrayBuffer>();

class SoundboardStore {
	sounds = new Map<string, Array<SoundboardSound>>();
	panelOpen = false;
	loading = false;

	constructor() {
		makeAutoObservable<SoundboardStore, never>(this, {}, {autoBind: true});
	}

	getSounds(guildId: string): Array<SoundboardSound> {
		return this.sounds.get(guildId) ?? [];
	}

	setSounds(guildId: string, sounds: Array<SoundboardSound>): void {
		this.sounds.set(guildId, sounds);
	}

	addSound(guildId: string, sound: SoundboardSound): void {
		const existing = this.sounds.get(guildId) ?? [];
		this.sounds.set(guildId, [...existing, sound]);
	}

	removeSound(guildId: string, soundId: string): void {
		const existing = this.sounds.get(guildId) ?? [];
		this.sounds.set(
			guildId,
			existing.filter((s) => s.id !== soundId),
		);
	}

	updateSound(guildId: string, soundId: string, patch: Partial<SoundboardSound>): void {
		const existing = this.sounds.get(guildId) ?? [];
		this.sounds.set(
			guildId,
			existing.map((s) => (s.id === soundId ? {...s, ...patch} : s)),
		);
	}

	togglePanel(): void {
		this.panelOpen = !this.panelOpen;
	}

	closePanel(): void {
		this.panelOpen = false;
	}

	setLoading(loading: boolean): void {
		this.loading = loading;
	}

	private lastPlayedKey = '';
	private lastPlayedAt = 0;

	handleSoundPlay(payload: SoundPlayPayload): void {
		const voiceState = MediaEngineStore.getCurrentUserVoiceState();
		if (!voiceState || voiceState.channel_id !== payload.channel_id) {
			return;
		}

		// Debounce duplicate plays of the same sound within 2 seconds
		const key = `${payload.sound_id}:${payload.user_id}`;
		const now = Date.now();
		if (key === this.lastPlayedKey && now - this.lastPlayedAt < 2000) {
			return;
		}
		this.lastPlayedKey = key;
		this.lastPlayedAt = now;

		void this.playSoundLocally(payload);
	}

	private async playSoundLocally(payload: SoundPlayPayload): Promise<void> {
		try {
			const cacheKey = `${payload.guild_id}:${payload.sound_id}`;
			let arrayBuffer = audioBufferCache.get(cacheKey);

			if (!arrayBuffer) {
				const url = Endpoints.GUILD_SOUNDBOARD_AUDIO(payload.guild_id, payload.sound_id);
				const response = await http.get<Blob>({url, binary: true});
				arrayBuffer = await response.body.arrayBuffer();
				audioBufferCache.set(cacheKey, arrayBuffer);
			}

			const audioContext = new AudioContext();
			const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
			const source = audioContext.createBufferSource();
			source.buffer = audioBuffer;

			const gainNode = audioContext.createGain();
			gainNode.gain.value = payload.volume;

			source.connect(gainNode);
			gainNode.connect(audioContext.destination);

			source.start();
			source.onended = () => {
				void audioContext.close();
			};

			logger.debug('Playing sound', {name: payload.name, volume: payload.volume});
		} catch (error) {
			logger.error('Failed to play soundboard sound', error);
		}
	}
}

export default new SoundboardStore();
