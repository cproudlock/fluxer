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

import type {GuildID, SoundID} from '@fluxer/api/src/BrandedTypes';
import {Db, deleteOneOrMany, fetchMany, fetchOne, upsertOne} from '@fluxer/api/src/database/Cassandra';
import type {GuildSoundboardSoundRow} from '@fluxer/api/src/database/types/SoundboardTypes';
import {GuildSoundboardSounds} from '@fluxer/api/src/Tables';

const FETCH_SOUNDS_BY_GUILD_QUERY = GuildSoundboardSounds.selectCql({
	where: GuildSoundboardSounds.where.eq('guild_id'),
});

const FETCH_SOUND_BY_ID_QUERY = GuildSoundboardSounds.selectCql({
	where: [GuildSoundboardSounds.where.eq('guild_id'), GuildSoundboardSounds.where.eq('sound_id')],
});

export class SoundboardRepository {
	async listByGuild(guildId: GuildID): Promise<Array<GuildSoundboardSoundRow>> {
		return fetchMany<GuildSoundboardSoundRow>(FETCH_SOUNDS_BY_GUILD_QUERY, {guild_id: guildId});
	}

	async findById(guildId: GuildID, soundId: SoundID): Promise<GuildSoundboardSoundRow | null> {
		return fetchOne<GuildSoundboardSoundRow>(FETCH_SOUND_BY_ID_QUERY, {guild_id: guildId, sound_id: soundId});
	}

	async create(row: GuildSoundboardSoundRow): Promise<void> {
		await upsertOne(GuildSoundboardSounds.insert(row));
	}

	async update(
		guildId: GuildID,
		soundId: SoundID,
		patch: Partial<Pick<GuildSoundboardSoundRow, 'name' | 'emoji' | 'volume'>>,
	): Promise<void> {
		const dbPatch: Record<string, ReturnType<typeof Db.set>> = {};
		if (patch.name !== undefined) dbPatch.name = Db.set(patch.name);
		if (patch.emoji !== undefined) dbPatch.emoji = Db.set(patch.emoji);
		if (patch.volume !== undefined) dbPatch.volume = Db.set(patch.volume);
		await upsertOne(GuildSoundboardSounds.patchByPk({guild_id: guildId, sound_id: soundId}, dbPatch));
	}

	async delete(guildId: GuildID, soundId: SoundID): Promise<void> {
		await deleteOneOrMany(GuildSoundboardSounds.deleteByPk({guild_id: guildId, sound_id: soundId}));
	}

	async countByGuild(guildId: GuildID): Promise<number> {
		const rows = await this.listByGuild(guildId);
		return rows.length;
	}
}
