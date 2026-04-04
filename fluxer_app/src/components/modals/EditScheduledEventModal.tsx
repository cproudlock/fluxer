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
import * as ScheduledEventActionCreators from '@app/actions/ScheduledEventActionCreators';
import * as ToastActionCreators from '@app/actions/ToastActionCreators';
import {Input, Textarea} from '@app/components/form/Input';
import {Select} from '@app/components/form/Select';
import type {SelectOption} from '@app/components/form/Select';
import * as Modal from '@app/components/modals/Modal';
import {Button} from '@app/components/uikit/button/Button';
import ChannelStore from '@app/stores/ChannelStore';
import type {ScheduledEvent} from '@app/stores/ScheduledEventStore';
import * as AvatarUtils from '@app/utils/AvatarUtils';
import {ChannelTypes} from '@fluxer/constants/src/ChannelConstants';
import {GuildScheduledEventEntityType} from '@fluxer/constants/src/ScheduledEventConstants';
import {ImageIcon, MapPinIcon, SpeakerHighIcon, XCircleIcon} from '@phosphor-icons/react';
import {useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import {useRef, useState} from 'react';

const TIME_OPTIONS: Array<SelectOption<string>> = Array.from({length: 48}, (_, i) => {
	const h = Math.floor(i / 2);
	const m = i % 2 === 0 ? '00' : '30';
	const val = `${String(h).padStart(2, '0')}:${m}`;
	const d = new Date(`2000-01-01T${val}`);
	return {value: val, label: d.toLocaleTimeString(undefined, {hour: 'numeric', minute: '2-digit'})};
});

function dateToLocalDate(iso: string): string {
	const d = new Date(iso);
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dateToLocalTime(iso: string): string {
	const d = new Date(iso);
	const h = d.getHours();
	const m = d.getMinutes() >= 30 ? '30' : '00';
	return `${String(h).padStart(2, '0')}:${m}`;
}

const radioStyle = (selected: boolean) => ({
	display: 'flex',
	alignItems: 'center',
	gap: 12,
	padding: '12px 16px',
	borderRadius: 8,
	border: `2px solid ${selected ? 'var(--brand-experiment)' : 'var(--background-modifier-accent)'}`,
	background: selected ? 'rgba(88, 101, 242, 0.1)' : 'transparent',
	cursor: 'pointer',
	width: '100%',
	textAlign: 'left' as const,
	transition: 'border-color 0.15s, background 0.15s',
});

interface EditScheduledEventModalProps {
	event: ScheduledEvent;
}

export const EditScheduledEventModal = observer(({event}: EditScheduledEventModalProps) => {
	const {t} = useLingui();
	const [submitting, setSubmitting] = useState(false);

	const [entityType, setEntityType] = useState<number>(event.entity_type);
	const [channelId, setChannelId] = useState(event.channel_id ?? '');
	const [location, setLocation] = useState(event.location ?? '');
	const [name, setName] = useState(event.name);
	const [description, setDescription] = useState(event.description ?? '');
	const [startDate, setStartDate] = useState(dateToLocalDate(event.scheduled_start_time));
	const [startTime, setStartTime] = useState(dateToLocalTime(event.scheduled_start_time));
	const [endDate, setEndDate] = useState(event.scheduled_end_time ? dateToLocalDate(event.scheduled_end_time) : '');
	const [endTime, setEndTime] = useState(event.scheduled_end_time ? dateToLocalTime(event.scheduled_end_time) : '');

	const existingCoverUrl = event.cover_image
		? AvatarUtils.getGuildBannerURL({id: event.id, banner: event.cover_image})
		: null;
	const [coverImage, setCoverImage] = useState<string | null | undefined>(undefined);
	const [coverPreview, setCoverPreview] = useState<string | null>(existingCoverUrl);
	const coverInputRef = useRef<HTMLInputElement>(null);

	const handleCoverImagePick = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;
		const reader = new FileReader();
		reader.onload = () => {
			const dataUrl = reader.result as string;
			setCoverImage(dataUrl);
			setCoverPreview(dataUrl);
		};
		reader.readAsDataURL(file);
		e.target.value = '';
	};

	const handleCoverImageRemove = () => {
		setCoverImage(null);
		setCoverPreview(null);
	};

	const voiceChannels = ChannelStore.getGuildChannels(event.guild_id).filter(
		(ch) => ch.type === ChannelTypes.GUILD_VOICE,
	);

	if (!channelId && voiceChannels.length > 0 && entityType === GuildScheduledEventEntityType.VOICE) {
		setChannelId(voiceChannels[0].id);
	}

	const canSave = !!name.trim() && !!startDate && !!startTime &&
		(entityType === GuildScheduledEventEntityType.VOICE ? !!channelId : !!location.trim());

	const handleSave = async () => {
		setSubmitting(true);
		const startTimeISO = new Date(`${startDate}T${startTime}`).toISOString();
		const endTimeISO = endDate && endTime ? new Date(`${endDate}T${endTime}`).toISOString() : null;

		try {
			await ScheduledEventActionCreators.updateEvent(event.guild_id, event.id, {
				name,
				description: description || null,
				scheduled_start_time: startTimeISO,
				scheduled_end_time: endTimeISO,
				entity_type: entityType,
				channel_id: entityType === GuildScheduledEventEntityType.VOICE ? channelId : null,
				location: entityType === GuildScheduledEventEntityType.EXTERNAL ? location : null,
				...(coverImage !== undefined ? {cover_image: coverImage} : {}),
			});
			ToastActionCreators.createToast({type: 'success', children: t`Event updated`});
			ModalActionCreators.pop();
		} catch {
			ToastActionCreators.createToast({type: 'error', children: t`Failed to update event`});
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<Modal.Root size="medium" centered>
			<Modal.Header title={t`Edit Event`} />
			<Modal.Content>
				<div>
					<Input
						label={t`Event Topic`}
						value={name}
						onChange={(e) => setName(e.target.value)}
						placeholder={t`What's your event?`}
						maxLength={100}
						required
						autoFocus
					/>

					<div style={{marginTop: '1rem'}}>
						<label style={{display: 'block', marginBottom: '0.5rem', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--header-secondary)'}}>
							{t`Location Type`}
						</label>
						<div style={{display: 'flex', flexDirection: 'column', gap: 8}}>
							<button
								type="button"
								onClick={() => setEntityType(GuildScheduledEventEntityType.VOICE)}
								style={radioStyle(entityType === GuildScheduledEventEntityType.VOICE)}
							>
								<div style={{
									width: 20, height: 20, borderRadius: '50%',
									border: `2px solid ${entityType === GuildScheduledEventEntityType.VOICE ? 'var(--brand-experiment)' : 'var(--text-muted)'}`,
									display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
								}}>
									{entityType === GuildScheduledEventEntityType.VOICE && (
										<div style={{width: 10, height: 10, borderRadius: '50%', background: 'var(--brand-experiment)'}} />
									)}
								</div>
								<div style={{display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, color: 'var(--header-primary)'}}>
									<SpeakerHighIcon size={16} /> {t`Voice Channel`}
								</div>
							</button>

							<button
								type="button"
								onClick={() => setEntityType(GuildScheduledEventEntityType.EXTERNAL)}
								style={radioStyle(entityType === GuildScheduledEventEntityType.EXTERNAL)}
							>
								<div style={{
									width: 20, height: 20, borderRadius: '50%',
									border: `2px solid ${entityType === GuildScheduledEventEntityType.EXTERNAL ? 'var(--brand-experiment)' : 'var(--text-muted)'}`,
									display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
								}}>
									{entityType === GuildScheduledEventEntityType.EXTERNAL && (
										<div style={{width: 10, height: 10, borderRadius: '50%', background: 'var(--brand-experiment)'}} />
									)}
								</div>
								<div style={{display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, color: 'var(--header-primary)'}}>
									<MapPinIcon size={16} /> {t`Somewhere Else`}
								</div>
							</button>
						</div>
					</div>

					{entityType === GuildScheduledEventEntityType.VOICE && voiceChannels.length > 0 && (
						<div style={{marginTop: '1rem'}}>
							<label style={{display: 'block', marginBottom: '0.5rem', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--header-secondary)'}}>
								{t`Select a channel`} <span style={{color: 'var(--text-danger)'}}>*</span>
							</label>
							<select
								value={channelId}
								onChange={(e) => setChannelId(e.target.value)}
								style={{width: '100%', padding: '0.5rem', borderRadius: 4, border: 'none', background: 'var(--input-background)', color: 'var(--text-normal)', fontSize: '0.875rem'}}
							>
								{voiceChannels.map((ch) => (
									<option key={ch.id} value={ch.id}>{ch.name}</option>
								))}
							</select>
						</div>
					)}

					{entityType === GuildScheduledEventEntityType.EXTERNAL && (
						<div style={{marginTop: '1rem'}}>
							<Input
								label={t`Enter a location`}
								value={location}
								onChange={(e) => setLocation(e.target.value)}
								placeholder={t`Add a location, link, or something.`}
								maxLength={100}
								required
							/>
						</div>
					)}

					<div style={{marginTop: '1rem', display: 'flex', gap: '0.5rem'}}>
						<div style={{flex: 1}}>
							<Input
								label={t`Start Date`}
								type="date"
								value={startDate}
								onChange={(e) => setStartDate(e.target.value)}
								required
							/>
						</div>
						<div style={{flex: 1}}>
							<Select
								label={t`Start Time`}
								value={startTime}
								options={TIME_OPTIONS}
								onChange={(v) => setStartTime(v)}
								isSearchable
								placeholder={t`Select time`}
							/>
						</div>
					</div>

					<div style={{marginTop: '0.75rem', display: 'flex', gap: '0.5rem'}}>
						<div style={{flex: 1}}>
							<Input
								label={t`End Date (Optional)`}
								type="date"
								value={endDate}
								onChange={(e) => setEndDate(e.target.value)}
							/>
						</div>
						<div style={{flex: 1}}>
							<Select
								label={t`End Time`}
								value={endTime}
								options={[{value: '', label: t`None`}, ...TIME_OPTIONS]}
								onChange={(v) => setEndTime(v)}
								isSearchable
								placeholder={t`Select time`}
							/>
						</div>
					</div>

					<div style={{marginTop: '1rem'}}>
						<Textarea
							label={t`Description`}
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							placeholder={t`Tell people a little more about your event.`}
							maxLength={1000}
							rows={3}
						/>
					</div>

					<div style={{marginTop: '1rem'}}>
						<label style={{display: 'block', marginBottom: '0.5rem', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--header-secondary)'}}>
							{t`Cover Image`}
						</label>
						<input
							ref={coverInputRef}
							type="file"
							accept="image/jpeg,image/png,image/webp"
							onChange={handleCoverImagePick}
							style={{display: 'none'}}
						/>
						{coverPreview ? (
							<div style={{position: 'relative', borderRadius: 8, overflow: 'hidden'}}>
								<img
									src={coverPreview}
									alt={t`Cover preview`}
									style={{width: '100%', maxHeight: 160, objectFit: 'cover', display: 'block', borderRadius: 8}}
								/>
								<button
									type="button"
									onClick={handleCoverImageRemove}
									style={{
										position: 'absolute',
										top: 8,
										right: 8,
										background: 'rgba(0,0,0,0.6)',
										border: 'none',
										borderRadius: '50%',
										padding: 4,
										cursor: 'pointer',
										display: 'flex',
										alignItems: 'center',
										justifyContent: 'center',
										color: 'white',
									}}
								>
									<XCircleIcon size={20} />
								</button>
							</div>
						) : (
							<button
								type="button"
								onClick={() => coverInputRef.current?.click()}
								style={{
									display: 'flex',
									alignItems: 'center',
									gap: 8,
									padding: '12px 16px',
									borderRadius: 8,
									border: '2px dashed var(--background-modifier-accent)',
									background: 'transparent',
									color: 'var(--text-muted)',
									cursor: 'pointer',
									width: '100%',
									fontSize: '0.875rem',
								}}
							>
								<ImageIcon size={20} />
								{t`Upload Cover Image`}
							</button>
						)}
					</div>
				</div>
			</Modal.Content>

			<Modal.Footer>
				<Button onClick={ModalActionCreators.pop} variant="secondary">
					{t`Cancel`}
				</Button>
				<Button onClick={handleSave} submitting={submitting} disabled={!canSave}>
					{t`Save Changes`}
				</Button>
			</Modal.Footer>
		</Modal.Root>
	);
});
