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

import * as SoundboardActionCreators from '@app/actions/SoundboardActionCreators';
import {MenuGroup} from '@app/components/uikit/context_menu/MenuGroup';
import {MenuItem} from '@app/components/uikit/context_menu/MenuItem';
import {Logger} from '@app/lib/Logger';
import SoundboardStore from '@app/stores/SoundboardStore';
import {useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import {useEffect} from 'react';

const logger = new Logger('SoundboardContextMenu');

interface SoundboardContextMenuProps {
	guildId: string;
	channelId: string;
	onClose: () => void;
}

export const SoundboardContextMenu: React.FC<SoundboardContextMenuProps> = observer(
	({guildId, channelId, onClose}) => {
		const {t} = useLingui();
		const sounds = SoundboardStore.getSounds(guildId);
		const loading = SoundboardStore.loading;

		useEffect(() => {
			void SoundboardActionCreators.fetchSounds(guildId);
		}, [guildId]);

		const handlePlaySound = (soundId: string) => {
			void SoundboardActionCreators.playSound(guildId, soundId, channelId).catch((error) => {
				logger.error('Failed to play sound', error);
			});
			onClose();
		};

		if (loading && sounds.length === 0) {
			return (
				<MenuGroup>
					<MenuItem disabled>{t`Loading...`}</MenuItem>
				</MenuGroup>
			);
		}

		if (sounds.length === 0) {
			return (
				<MenuGroup>
					<MenuItem disabled>{t`No sounds available`}</MenuItem>
				</MenuGroup>
			);
		}

		return (
			<MenuGroup>
				{sounds.map((sound) => (
					<MenuItem
						key={sound.id}
						icon={<span style={{fontSize: 16}}>{sound.emoji ?? '🔊'}</span>}
						onClick={() => handlePlaySound(sound.id)}
					>
						{sound.name}
					</MenuItem>
				))}
			</MenuGroup>
		);
	},
);
