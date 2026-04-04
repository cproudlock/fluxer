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

import * as ModalActionCreators from '@app/actions/ModalActionCreators';
import {modal} from '@app/actions/ModalActionCreators';
import * as SoundboardActionCreators from '@app/actions/SoundboardActionCreators';
import * as ToastActionCreators from '@app/actions/ToastActionCreators';
import {ConfirmModal} from '@app/components/modals/ConfirmModal';
import styles from '@app/components/modals/guild_tabs/SoundboardSettingsTab.module.css';
import {Spinner} from '@app/components/uikit/Spinner';
import {Logger} from '@app/lib/Logger';
import type {SoundboardSound} from '@app/stores/SoundboardStore';
import SoundboardStore from '@app/stores/SoundboardStore';
import {openFilePicker} from '@app/utils/FilePickerUtils';
import {Trans, useLingui} from '@lingui/react/macro';
import {PlusIcon} from '@phosphor-icons/react';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useCallback, useEffect, useRef, useState} from 'react';

const MAX_SOUNDS = 24;
const MAX_FILE_SIZE = 1024 * 1024; // 1MB
const MAX_DURATION_SECONDS = 5;
const ACCEPTED_AUDIO_TYPES = '.mp3,.ogg,.wav,.webm,.m4a';

const logger = new Logger('SoundboardSettingsTab');

function formatDuration(ms: number): string {
	const seconds = (ms / 1000).toFixed(1);
	return `${seconds}s`;
}

async function validateAudioDuration(file: File): Promise<{valid: boolean}> {
	return new Promise((resolve) => {
		const audio = new Audio();
		const url = URL.createObjectURL(file);
		audio.onloadedmetadata = () => {
			URL.revokeObjectURL(url);
			resolve({valid: audio.duration <= MAX_DURATION_SECONDS});
		};
		audio.onerror = () => {
			URL.revokeObjectURL(url);
			resolve({valid: false});
		};
		audio.src = url;
	});
}

function SoundItem({sound, guildId, onDelete}: {sound: SoundboardSound; guildId: string; onDelete: () => void}) {
	const {t} = useLingui();
	const [editing, setEditing] = useState(false);
	const [editName, setEditName] = useState(sound.name);
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (editing && inputRef.current) {
			inputRef.current.focus();
			inputRef.current.select();
		}
	}, [editing]);

	const handleSave = async () => {
		const trimmed = editName.trim();
		if (trimmed.length === 0 || trimmed === sound.name) {
			setEditing(false);
			setEditName(sound.name);
			return;
		}
		try {
			await SoundboardActionCreators.updateSound(guildId, sound.id, {name: trimmed});
			setEditing(false);
		} catch (error) {
			logger.error('Failed to rename sound', error);
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === 'Enter') {
			void handleSave();
		} else if (e.key === 'Escape') {
			setEditing(false);
			setEditName(sound.name);
		}
	};

	return (
		<div className={styles.soundItem}>
			<span className={styles.soundEmoji}>{sound.emoji ?? '🔊'}</span>
			<div className={styles.soundInfo}>
				{editing ? (
					<input
						ref={inputRef}
						type="text"
						className={styles.soundNameInput}
						value={editName}
						onChange={(e) => setEditName(e.target.value)}
						onBlur={() => void handleSave()}
						onKeyDown={handleKeyDown}
						maxLength={32}
					/>
				) : (
					<div className={styles.soundName}>{sound.name}</div>
				)}
				<div className={styles.soundMeta}>
					{formatDuration(sound.duration_ms)} &middot; Vol: {Math.round(sound.volume * 100)}%
				</div>
			</div>
			<div className={styles.soundActions}>
				{!editing && (
					<button
						type="button"
						className={styles.actionButton}
						onClick={() => {
							setEditName(sound.name);
							setEditing(true);
						}}
					>
						{t`Rename`}
					</button>
				)}
				<button type="button" className={styles.deleteButton} onClick={onDelete}>
					{t`Delete`}
				</button>
			</div>
		</div>
	);
}

const SoundboardSettingsTab: React.FC<{guildId: string}> = observer(function SoundboardSettingsTab({guildId}) {
	const {t} = useLingui();
	const [fetchStatus, setFetchStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
	const sounds = SoundboardStore.getSounds(guildId);

	useEffect(() => {
		async function load() {
			setFetchStatus('pending');
			try {
				await SoundboardActionCreators.fetchSounds(guildId);
				setFetchStatus('success');
			} catch {
				setFetchStatus('error');
			}
		}
		void load();
	}, [guildId]);

	const handleUpload = useCallback(async () => {
		if (sounds.length >= MAX_SOUNDS) {
			ToastActionCreators.createToast({type: 'error', children: t`Maximum of ${MAX_SOUNDS} sounds reached`});
			return;
		}

		const files = await openFilePicker({accept: ACCEPTED_AUDIO_TYPES, multiple: false});
		if (!files || files.length === 0) return;

		const file = files[0];
		if (file.size > MAX_FILE_SIZE) {
			ToastActionCreators.createToast({type: 'error', children: t`File must be 1MB or smaller`});
			return;
		}

		const {valid} = await validateAudioDuration(file);
		if (!valid) {
			ToastActionCreators.createToast({
				type: 'error',
				children: t`Sound must be ${MAX_DURATION_SECONDS} seconds or shorter`,
			});
			return;
		}

		const name = file.name.replace(/\.[^.]+$/, '').slice(0, 32) || 'sound';

		try {
			await SoundboardActionCreators.createSound(guildId, {
				name,
				volume: 0.8,
				file,
			});
			ToastActionCreators.success(t`Sound uploaded!`);
		} catch (error) {
			logger.error('Failed to upload sound', error);
			ToastActionCreators.createToast({type: 'error', children: t`Failed to upload sound`});
		}
	}, [guildId, sounds.length, t]);

	const handleDelete = useCallback(
		(sound: SoundboardSound) => {
			ModalActionCreators.push(
				modal(() => (
					<ConfirmModal
						title={t`Delete Sound`}
						description={<Trans>Are you sure you want to delete <strong>{sound.name}</strong>?</Trans>}
						primaryText={t`Delete`}
						onPrimary={async () => {
							try {
								await SoundboardActionCreators.deleteSound(guildId, sound.id);
								ToastActionCreators.success(t`Sound deleted`);
							} catch (error) {
								logger.error('Failed to delete sound', error);
								ToastActionCreators.createToast({type: 'error', children: t`Failed to delete sound`});
							}
						}}
					/>
				)),
			);
		},
		[guildId, t],
	);

	if (fetchStatus === 'pending') {
		return (
			<div className={styles.loading}>
				<Spinner />
			</div>
		);
	}

	return (
		<div className={styles.container}>
			<div className={styles.header}>
				<span className={styles.title}>{t`Soundboard`}</span>
				<button
					type="button"
					className={styles.uploadButton}
					onClick={handleUpload}
					disabled={sounds.length >= MAX_SOUNDS}
				>
					<PlusIcon weight="bold" size={16} />
					{t`Upload Sound`}
				</button>
			</div>

			<div className={styles.slotInfo}>
				{t`${sounds.length} / 24 sound slots used`}
			</div>

			{sounds.length === 0 ? (
				<div className={styles.empty}>
					{t`No sounds yet. Upload audio files to use in voice channels.`}
				</div>
			) : (
				<div className={styles.soundList}>
					{sounds.map((sound) => (
						<SoundItem
							key={sound.id}
							sound={sound}
							guildId={guildId}
							onDelete={() => handleDelete(sound)}
						/>
					))}
				</div>
			)}
		</div>
	);
});

export default SoundboardSettingsTab;
