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

import SoundboardStore from '@app/stores/SoundboardStore';
import type {GatewayHandlerContext} from '@app/stores/gateway/handlers/index';

interface SoundboardPlayPayload {
	guild_id: string;
	channel_id: string;
	sound_id: string;
	user_id: string;
	volume: number;
	file_key: string;
	name: string;
	emoji: string | null;
}

export function handleGuildSoundboardSoundPlay(data: unknown, _context: GatewayHandlerContext): void {
	const payload = data as SoundboardPlayPayload;
	SoundboardStore.handleSoundPlay(payload);
}
