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
import styles from '@app/components/voice/SoundboardPanel.module.css';
import {Logger} from '@app/lib/Logger';
import SoundboardStore from '@app/stores/SoundboardStore';
import MediaEngineStore from '@app/stores/voice/MediaEngineFacade';
import {useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import {useCallback, useEffect, useRef} from 'react';

const logger = new Logger('SoundboardPanel');

export const SoundboardPanel = observer(function SoundboardPanel() {
	const {t} = useLingui();
	const panelRef = useRef<HTMLDivElement>(null);
	const voiceState = MediaEngineStore.getCurrentUserVoiceState();
	const guildId = voiceState?.guild_id;
	const channelId = voiceState?.channel_id;
	const sounds = guildId ? SoundboardStore.getSounds(guildId) : [];
	const loading = SoundboardStore.loading;

	useEffect(() => {
		if (guildId && SoundboardStore.panelOpen) {
			void SoundboardActionCreators.fetchSounds(guildId);
		}
	}, [guildId, SoundboardStore.panelOpen]);

	useEffect(() => {
		function handleClickOutside(event: MouseEvent) {
			if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
				SoundboardActionCreators.closePanel();
			}
		}

		if (SoundboardStore.panelOpen) {
			document.addEventListener('mousedown', handleClickOutside);
			return () => document.removeEventListener('mousedown', handleClickOutside);
		}
		return undefined;
	}, [SoundboardStore.panelOpen]);

	const handlePlaySound = useCallback(
		(soundId: string) => {
			if (!guildId || !channelId) return;
			void SoundboardActionCreators.playSound(guildId, soundId, channelId).catch((error) => {
				logger.error('Failed to play sound', error);
			});
		},
		[guildId, channelId],
	);

	if (!SoundboardStore.panelOpen || !guildId) return null;

	return (
		<div ref={panelRef} className={styles.panel}>
			<div className={styles.header}>
				<span className={styles.title}>{t`Soundboard`}</span>
			</div>
			{loading ? (
				<div className={styles.loading}>{t`Loading...`}</div>
			) : sounds.length === 0 ? (
				<div className={styles.empty}>{t`No sounds yet. Add them in server settings.`}</div>
			) : (
				<div className={styles.grid}>
					{sounds.map((sound) => (
						<button
							key={sound.id}
							type="button"
							className={styles.soundButton}
							onClick={() => handlePlaySound(sound.id)}
							title={sound.name}
						>
							<span className={styles.soundEmoji}>{sound.emoji ?? '🔊'}</span>
							<span className={styles.soundName}>{sound.name}</span>
						</button>
					))}
				</div>
			)}
		</div>
	);
});
