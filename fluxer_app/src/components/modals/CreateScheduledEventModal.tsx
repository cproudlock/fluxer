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
import * as ScheduledEventActionCreators from '@app/actions/ScheduledEventActionCreators';
import * as ToastActionCreators from '@app/actions/ToastActionCreators';
import {Input, Textarea} from '@app/components/form/Input';
import {Select} from '@app/components/form/Select';
import type {SelectOption} from '@app/components/form/Select';
import * as Modal from '@app/components/modals/Modal';
import {Button} from '@app/components/uikit/button/Button';
import ChannelStore from '@app/stores/ChannelStore';
import {ChannelTypes} from '@fluxer/constants/src/ChannelConstants';
import {GuildScheduledEventEntityType} from '@fluxer/constants/src/ScheduledEventConstants';
import {CalendarIcon, ImageIcon, MapPinIcon, SpeakerHighIcon, UsersIcon, XCircleIcon} from '@phosphor-icons/react';
import {useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import {useRef, useState} from 'react';

type Step = 'location' | 'info' | 'review';

const TIME_OPTIONS: Array<SelectOption<string>> = Array.from({length: 48}, (_, i) => {
	const h = Math.floor(i / 2);
	const m = i % 2 === 0 ? '00' : '30';
	const val = `${String(h).padStart(2, '0')}:${m}`;
	const d = new Date(`2000-01-01T${val}`);
	return {value: val, label: d.toLocaleTimeString(undefined, {hour: 'numeric', minute: '2-digit'})};
});

function getDefaultDateTime() {
	const now = new Date();
	now.setHours(now.getHours() + 1, 0, 0, 0);
	const date = now.toISOString().split('T')[0];
	const time = now.toTimeString().slice(0, 5);
	return {date, time};
}

function formatPreviewTime(startDate: string, startTime: string): string {
	const start = new Date(`${startDate}T${startTime}`);
	const now = Date.now();
	const diff = start.getTime() - now;
	if (diff < 0) return 'Starting now';
	if (diff < 3600000) return `Starting in ${Math.ceil(diff / 60000)}m`;
	if (diff < 86400000) return `Starting in ${Math.ceil(diff / 3600000)}h`;
	return `Starting in ${Math.ceil(diff / 86400000)}d`;
}

const stepStyle = (active: boolean, completed: boolean) => ({
	flex: 1,
	height: 3,
	borderRadius: 2,
	background: active || completed ? 'var(--brand-experiment)' : 'var(--background-modifier-accent)',
	transition: 'background 0.2s',
});

const stepLabelStyle = (active: boolean) => ({
	fontSize: '0.6875rem',
	fontWeight: active ? 700 : 500,
	color: active ? 'var(--brand-experiment)' : 'var(--text-muted)',
	textAlign: 'center' as const,
});

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

export const CreateScheduledEventModal = observer(({guildId}: {guildId: string}) => {
	const {t} = useLingui();
	const defaults = getDefaultDateTime();
	const [step, setStep] = useState<Step>('location');
	const [submitting, setSubmitting] = useState(false);

	const [entityType, setEntityType] = useState<number>(GuildScheduledEventEntityType.VOICE);
	const [channelId, setChannelId] = useState('');
	const [location, setLocation] = useState('');
	const [name, setName] = useState('');
	const [description, setDescription] = useState('');
	const [startDate, setStartDate] = useState(defaults.date);
	const [startTime, setStartTime] = useState(defaults.time);
	const [endDate, setEndDate] = useState('');
	const [endTime, setEndTime] = useState('');
	const [coverImage, setCoverImage] = useState<string | null>(null);
	const [coverPreview, setCoverPreview] = useState<string | null>(null);
	const coverInputRef = useRef<HTMLInputElement>(null);

	const voiceChannels = ChannelStore.getGuildChannels(guildId).filter(
		(ch) => ch.type === ChannelTypes.GUILD_VOICE,
	);

	if (!channelId && voiceChannels.length > 0) {
		setChannelId(voiceChannels[0].id);
	}

	const selectedChannel = voiceChannels.find((ch) => ch.id === channelId);

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

	const canProceedFromLocation =
		entityType === GuildScheduledEventEntityType.VOICE
			? !!channelId
			: !!location.trim();

	const canProceedFromInfo = !!name.trim() && !!startDate && !!startTime;

	const handleCreate = async () => {
		setSubmitting(true);
		const startTimeISO = new Date(`${startDate}T${startTime}`).toISOString();
		const endTimeISO = endDate && endTime ? new Date(`${endDate}T${endTime}`).toISOString() : null;

		try {
			const result = await ScheduledEventActionCreators.createEvent(guildId, {
				name,
				description: description || null,
				scheduled_start_time: startTimeISO,
				scheduled_end_time: endTimeISO,
				entity_type: entityType,
				channel_id: entityType === GuildScheduledEventEntityType.VOICE ? channelId : null,
				location: entityType === GuildScheduledEventEntityType.EXTERNAL ? location : null,
				cover_image: coverImage,
			}) as {id?: string} | undefined;
			ModalActionCreators.pop();
			if (result?.id) {
				const eventLink = `${window.location.origin}/channels/${guildId}?event=${result.id}`;
				ModalActionCreators.push(modal(() => <ShareEventModal link={eventLink} />));
			}
		} catch {
			ToastActionCreators.createToast({type: 'error', children: t`Failed to create event`});
		} finally {
			setSubmitting(false);
		}
	};

	const stepIndex = step === 'location' ? 0 : step === 'info' ? 1 : 2;

	return (
		<Modal.Root size="medium" centered>
			<Modal.ScreenReaderLabel text="Create Event" />
			<div style={{padding: '16px 16px 0'}}>
				<div style={{display: 'flex', gap: 4, marginBottom: 8}}>
					<div style={stepStyle(stepIndex >= 0, stepIndex > 0)} />
					<div style={stepStyle(stepIndex >= 1, stepIndex > 1)} />
					<div style={stepStyle(stepIndex >= 2, false)} />
				</div>
				<div style={{display: 'flex', gap: 4}}>
					<div style={{flex: 1, ...stepLabelStyle(step === 'location')}}>{t`Location`}</div>
					<div style={{flex: 1, ...stepLabelStyle(step === 'info')}}>{t`Event Info`}</div>
					<div style={{flex: 1, ...stepLabelStyle(step === 'review')}}>{t`Review`}</div>
				</div>
			</div>

			<Modal.Content>
				{step === 'location' && (
					<div>
						<h2 style={{fontSize: '1.25rem', fontWeight: 700, color: 'var(--header-primary)', marginBottom: '0.375rem'}}>
							{t`Where is your event?`}
						</h2>
						<p style={{fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1.25rem'}}>
							{t`So no one gets lost on where to go.`}
						</p>

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
								<div>
									<div style={{display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, color: 'var(--header-primary)'}}>
										<SpeakerHighIcon size={16} /> {t`Voice Channel`}
									</div>
									<div style={{fontSize: '0.8125rem', color: 'var(--text-muted)'}}>
										{t`Hang out with voice, video, screenshare, and Go Live.`}
									</div>
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
								<div>
									<div style={{display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, color: 'var(--header-primary)'}}>
										<MapPinIcon size={16} /> {t`Somewhere Else`}
									</div>
									<div style={{fontSize: '0.8125rem', color: 'var(--text-muted)'}}>
										{t`Text channel, external link, or in-person location.`}
									</div>
								</div>
							</button>
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
					</div>
				)}

				{step === 'info' && (
					<div>
						<h2 style={{fontSize: '1.25rem', fontWeight: 700, color: 'var(--header-primary)', marginBottom: '0.375rem'}}>
							{t`What's your event about?`}
						</h2>
						<p style={{fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1.25rem'}}>
							{t`Fill out the details of your event.`}
						</p>

						<Input
							label={t`Event Topic`}
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder={t`What's your event?`}
							maxLength={100}
							required
							autoFocus
						/>

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
				)}

				{step === 'review' && (
					<div>
						<div style={{
							borderRadius: 8,
							background: 'var(--background-secondary)',
							padding: '12px 16px',
							marginBottom: '1.5rem',
						}}>
							<div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8}}>
								<span style={{fontSize: '0.75rem', fontWeight: 600, color: 'var(--brand-experiment)'}}>
									<CalendarIcon size={14} style={{marginRight: 4, verticalAlign: 'middle'}} />
									{formatPreviewTime(startDate, startTime)}
								</span>
								<span style={{display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', color: 'var(--text-muted)'}}>
									<UsersIcon size={14} /> 0
								</span>
							</div>
							<div style={{fontSize: '1rem', fontWeight: 600, color: 'var(--header-primary)', marginBottom: 8}}>
								{name || t`Untitled Event`}
							</div>
							<div style={{display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem', color: 'var(--text-muted)'}}>
								{entityType === GuildScheduledEventEntityType.VOICE ? (
									<>
										<SpeakerHighIcon size={16} />
										{selectedChannel?.name ?? t`Voice Channel`}
									</>
								) : (
									<>
										<MapPinIcon size={16} />
										{location || t`External Location`}
									</>
								)}
							</div>
						</div>

						<h2 style={{fontSize: '1.25rem', fontWeight: 700, color: 'var(--header-primary)', textAlign: 'center', marginBottom: '0.375rem'}}>
							{t`Here's a preview of your event.`}
						</h2>
						<p style={{fontSize: '0.875rem', color: 'var(--text-muted)', textAlign: 'center'}}>
							{t`This event will auto start when it's time.`}
						</p>
					</div>
				)}
			</Modal.Content>

			<Modal.Footer>
				{step !== 'location' && (
					<Button
						onClick={() => setStep(step === 'review' ? 'info' : 'location')}
						variant="secondary"
						style={{marginRight: 'auto'}}
					>
						{t`Back`}
					</Button>
				)}
				<Button onClick={ModalActionCreators.pop} variant="secondary">
					{t`Cancel`}
				</Button>
				{step === 'location' && (
					<Button onClick={() => setStep('info')} disabled={!canProceedFromLocation}>
						{t`Next`}
					</Button>
				)}
				{step === 'info' && (
					<Button onClick={() => setStep('review')} disabled={!canProceedFromInfo}>
						{t`Next`}
					</Button>
				)}
				{step === 'review' && (
					<Button onClick={handleCreate} submitting={submitting}>
						{t`Create Event`}
					</Button>
				)}
			</Modal.Footer>
		</Modal.Root>
	);
});

const ShareEventModal = ({link}: {link: string}) => {
	const {t} = useLingui();
	const [copied, setCopied] = useState(false);

	const handleCopy = async () => {
		await navigator.clipboard.writeText(link);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	return (
		<Modal.Root size="small" centered>
			<Modal.ScreenReaderLabel text="Share Event" />
			<Modal.Content>
				<div style={{textAlign: 'center', padding: '1.5rem 0 1rem'}}>
					<CalendarIcon size={48} style={{color: 'var(--text-muted)', marginBottom: '1rem'}} />
					<h2 style={{fontSize: '1.25rem', fontWeight: 700, color: 'var(--header-primary)', marginBottom: '0.5rem'}}>
						{t`All set. Now share your event!`}
					</h2>
					<p style={{fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1.5rem'}}>
						{t`Copy the event link below to invite people to your event.`}
					</p>
					<div style={{
						display: 'flex',
						alignItems: 'center',
						gap: 8,
						background: 'var(--background-secondary)',
						borderRadius: 4,
						padding: '8px 12px',
					}}>
						<input
							readOnly
							value={link}
							style={{
								flex: 1,
								background: 'transparent',
								border: 'none',
								color: 'var(--text-muted)',
								fontSize: '0.875rem',
								outline: 'none',
							}}
							onFocus={(e) => e.target.select()}
						/>
						<Button onClick={handleCopy} variant={copied ? 'secondary' : 'primary'}>
							{copied ? t`Copied!` : t`Copy`}
						</Button>
					</div>
				</div>
			</Modal.Content>
			<Modal.Footer>
				<Button onClick={ModalActionCreators.pop} variant="secondary" style={{marginLeft: 'auto'}}>
					{t`Close`}
				</Button>
			</Modal.Footer>
		</Modal.Root>
	);
};
