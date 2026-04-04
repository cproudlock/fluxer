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
import {ConfirmModal} from '@app/components/modals/ConfirmModal';
import {EditScheduledEventModal} from '@app/components/modals/EditScheduledEventModal';
import * as Modal from '@app/components/modals/Modal';
import {Button} from '@app/components/uikit/button/Button';
import ChannelStore from '@app/stores/ChannelStore';
import PermissionStore from '@app/stores/PermissionStore';
import ScheduledEventStore from '@app/stores/ScheduledEventStore';
import type {ScheduledEvent} from '@app/stores/ScheduledEventStore';
import UserStore from '@app/stores/UserStore';
import * as AvatarUtils from '@app/utils/AvatarUtils';
import MediaEngineStore from '@app/stores/voice/MediaEngineFacade';
import {Permissions} from '@fluxer/constants/src/ChannelConstants';
import {GuildScheduledEventEntityType, GuildScheduledEventStatus} from '@fluxer/constants/src/ScheduledEventConstants';
import {CalendarIcon, DownloadSimpleIcon, MapPinIcon, MicrophoneIcon, PencilSimpleIcon, TrashIcon, UsersIcon} from '@phosphor-icons/react';
import {useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import {useEffect, useState} from 'react';

function getStatusLabel(status: number, t: ReturnType<typeof useLingui>['t']): string {
	switch (status) {
		case GuildScheduledEventStatus.SCHEDULED:
			return t`Scheduled`;
		case GuildScheduledEventStatus.ACTIVE:
			return t`Live`;
		case GuildScheduledEventStatus.COMPLETED:
			return t`Completed`;
		case GuildScheduledEventStatus.CANCELLED:
			return t`Cancelled`;
		default:
			return '';
	}
}

function getStatusColor(status: number): string {
	switch (status) {
		case GuildScheduledEventStatus.ACTIVE:
			return 'var(--status-positive)';
		case GuildScheduledEventStatus.COMPLETED:
		case GuildScheduledEventStatus.CANCELLED:
			return 'var(--text-muted)';
		default:
			return 'var(--brand-experiment)';
	}
}

function formatIcsDate(date: Date): string {
	return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function escapeIcsText(text: string): string {
	return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

function generateIcsFile(event: ScheduledEvent, channelName: string | null): void {
	const start = new Date(event.scheduled_start_time);
	const end = event.scheduled_end_time
		? new Date(event.scheduled_end_time)
		: new Date(start.getTime() + 3600000); // default 1 hour

	const locationStr =
		event.entity_type === GuildScheduledEventEntityType.EXTERNAL && event.location
			? event.location
			: channelName
				? `Voice: ${channelName}`
				: 'Online';

	const lines = [
		'BEGIN:VCALENDAR',
		'VERSION:2.0',
		'PRODID:-//Echowire//Scheduled Events//EN',
		'CALSCALE:GREGORIAN',
		'METHOD:PUBLISH',
		'BEGIN:VEVENT',
		`DTSTART:${formatIcsDate(start)}`,
		`DTEND:${formatIcsDate(end)}`,
		`SUMMARY:${escapeIcsText(event.name)}`,
		`LOCATION:${escapeIcsText(locationStr)}`,
		...(event.description ? [`DESCRIPTION:${escapeIcsText(event.description)}`] : []),
		`UID:${event.id}@echowire.org`,
		`DTSTAMP:${formatIcsDate(new Date())}`,
		'END:VEVENT',
		'END:VCALENDAR',
	];

	const blob = new Blob([lines.join('\r\n')], {type: 'text/calendar;charset=utf-8'});
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = `${event.name.replace(/[^a-zA-Z0-9 ]/g, '').trim().replace(/\s+/g, '-')}.ics`;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}

interface ScheduledEventDetailModalProps {
	event: ScheduledEvent;
}

export const ScheduledEventDetailModal = observer(({event}: ScheduledEventDetailModalProps) => {
	const {t} = useLingui();
	const [rsvpLoading, setRsvpLoading] = useState(false);
	const [interestedUserIds, setInterestedUserIds] = useState<Array<string>>([]);
	const canManageEvents = PermissionStore.can(Permissions.MANAGE_EVENTS, {guildId: event.guild_id});
	const isInterested = ScheduledEventStore.isInterested(event.id);

	const liveEvent = ScheduledEventStore.getEvents(event.guild_id).find((e) => e.id === event.id) ?? event;

	useEffect(() => {
		void ScheduledEventActionCreators.fetchInterestedUsers(event.guild_id, event.id).then((users: any) => {
			if (Array.isArray(users)) {
				setInterestedUserIds(users.map((u: any) => u.user_id));
				const interested = new Set(users.map((u: any) => u.user_id as string));
				ScheduledEventStore.interestedUsers.set(event.id, interested);
			}
		});
	}, [event.guild_id, event.id]);

	const startDate = new Date(liveEvent.scheduled_start_time);
	const endDate = liveEvent.scheduled_end_time ? new Date(liveEvent.scheduled_end_time) : null;

	const voiceChannel = liveEvent.channel_id ? ChannelStore.getChannel(liveEvent.channel_id) : null;

	const handleToggleInterested = async () => {
		setRsvpLoading(true);
		try {
			if (isInterested) {
				await ScheduledEventActionCreators.removeInterest(liveEvent.guild_id, liveEvent.id);
			} else {
				await ScheduledEventActionCreators.markInterested(liveEvent.guild_id, liveEvent.id);
			}
		} catch {
			ToastActionCreators.createToast({type: 'error', children: t`Failed to update interest`});
		} finally {
			setRsvpLoading(false);
		}
	};

	const handleEdit = () => {
		ModalActionCreators.push(
			modal(() => <EditScheduledEventModal event={liveEvent} />),
		);
	};

	const handleDelete = () => {
		ModalActionCreators.push(
			modal(() => (
				<ConfirmModal
					title={t`Delete Event`}
					description={t`Are you sure you want to delete "${liveEvent.name}"? This action cannot be undone.`}
					primaryText={t`Delete Event`}
					primaryVariant="danger-primary"
					onPrimary={async () => {
						try {
							await ScheduledEventActionCreators.deleteEvent(liveEvent.guild_id, liveEvent.id);
							ToastActionCreators.createToast({type: 'success', children: t`Event deleted`});
							ModalActionCreators.pop();
						} catch {
							ToastActionCreators.createToast({type: 'error', children: t`Failed to delete event`});
						}
					}}
				/>
			)),
		);
	};

	const handleExportCalendar = () => {
		generateIcsFile(liveEvent, voiceChannel?.name ?? null);
	};

	const handleJoinVoice = () => {
		if (voiceChannel) {
			MediaEngineStore.connectToVoiceChannel(liveEvent.guild_id, voiceChannel.id);
			ModalActionCreators.pop();
		}
	};

	return (
		<Modal.Root size="small" centered>
			<Modal.Header title={liveEvent.name} />
			<Modal.Content>
				{liveEvent.cover_image && (
					<div style={{marginBottom: '1rem', borderRadius: 8, overflow: 'hidden'}}>
						<img
							src={AvatarUtils.getGuildBannerURL({id: liveEvent.id, banner: liveEvent.cover_image})}
							alt={liveEvent.name}
							style={{width: '100%', maxHeight: 200, objectFit: 'cover', display: 'block'}}
						/>
					</div>
				)}
				<div style={{display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1rem'}}>
					<span style={{
						padding: '2px 8px',
						borderRadius: 99,
						background: getStatusColor(liveEvent.status),
						color: 'white',
						fontSize: '0.6875rem',
						fontWeight: 700,
						textTransform: 'uppercase',
					}}>
						{getStatusLabel(liveEvent.status, t)}
					</span>
					<span style={{display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.8125rem', color: 'var(--text-muted)'}}>
						<UsersIcon size={14} />
						{liveEvent.user_count} {t`interested`}
					</span>
				</div>

				<div style={{display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem'}}>
					<div style={{display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.875rem', color: 'var(--text-normal)'}}>
						<CalendarIcon size={18} style={{color: 'var(--text-muted)', flexShrink: 0}} />
						<div>
							<div>{startDate.toLocaleDateString(undefined, {weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'})}</div>
							<div style={{color: 'var(--text-muted)', fontSize: '0.8125rem'}}>
								{startDate.toLocaleTimeString(undefined, {hour: 'numeric', minute: '2-digit'})}
								{endDate && ` — ${endDate.toLocaleTimeString(undefined, {hour: 'numeric', minute: '2-digit'})}`}
							</div>
						</div>
					</div>

					{liveEvent.entity_type === GuildScheduledEventEntityType.VOICE && voiceChannel && (
						<div style={{display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.875rem', color: 'var(--text-normal)'}}>
							<MicrophoneIcon size={18} style={{color: 'var(--text-muted)', flexShrink: 0}} />
							{voiceChannel.name}
						</div>
					)}

					{liveEvent.entity_type === GuildScheduledEventEntityType.EXTERNAL && liveEvent.location && (
						<div style={{display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.875rem', color: 'var(--text-normal)'}}>
							<MapPinIcon size={18} style={{color: 'var(--text-muted)', flexShrink: 0}} />
							{liveEvent.location}
						</div>
					)}
				</div>

				{liveEvent.description && (
					<div style={{marginBottom: '1rem'}}>
						<div style={{fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--header-secondary)', marginBottom: '0.375rem'}}>
							{t`Description`}
						</div>
						<div style={{fontSize: '0.875rem', color: 'var(--text-normal)', whiteSpace: 'pre-wrap'}}>
							{liveEvent.description}
						</div>
					</div>
				)}

				{interestedUserIds.length > 0 && (
					<div style={{marginBottom: '1rem'}}>
						<div style={{fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--header-secondary)', marginBottom: '0.375rem'}}>
							{t`Interested`} — {interestedUserIds.length}
						</div>
						<div style={{display: 'flex', flexWrap: 'wrap', gap: '0.5rem'}}>
							{interestedUserIds.map((userId) => {
								const user = UserStore.getUser(userId);
								return (
									<span key={userId} style={{
										display: 'inline-flex',
										alignItems: 'center',
										gap: '0.375rem',
										padding: '0.25rem 0.5rem',
										borderRadius: 99,
										background: 'var(--background-secondary)',
										fontSize: '0.8125rem',
										color: 'var(--text-normal)',
									}}>
										{user?.displayName ?? userId}
									</span>
								);
							})}
						</div>
					</div>
				)}

				{liveEvent.status !== GuildScheduledEventStatus.COMPLETED &&
					liveEvent.status !== GuildScheduledEventStatus.CANCELLED && (
						<Button onClick={handleExportCalendar} variant="secondary" style={{width: '100%', marginBottom: '0.75rem'}}>
							<DownloadSimpleIcon size={16} />
							{t`Add to Calendar`}
						</Button>
					)}

				{liveEvent.status === GuildScheduledEventStatus.ACTIVE &&
					liveEvent.entity_type === GuildScheduledEventEntityType.VOICE &&
					voiceChannel && (
						<Button onClick={handleJoinVoice} style={{width: '100%', marginBottom: '0.75rem'}}>
							<MicrophoneIcon size={16} />
							{t`Join Voice Channel`}
						</Button>
					)}
			</Modal.Content>
			<Modal.Footer>
				{canManageEvents && (
					<div style={{display: 'flex', gap: 8, marginRight: 'auto'}}>
						<Button onClick={handleEdit} variant="secondary">
							<PencilSimpleIcon size={16} />
							{t`Edit`}
						</Button>
						<Button onClick={handleDelete} variant="danger-primary">
							<TrashIcon size={16} />
							{t`Delete`}
						</Button>
					</div>
				)}
				<Button onClick={ModalActionCreators.pop} variant="secondary">
					{t`Close`}
				</Button>
				{liveEvent.status !== GuildScheduledEventStatus.COMPLETED &&
					liveEvent.status !== GuildScheduledEventStatus.CANCELLED && (
						<Button
							onClick={handleToggleInterested}
							submitting={rsvpLoading}
							variant={isInterested ? 'secondary' : 'primary'}
						>
							{isInterested ? t`Not Interested` : t`Interested`}
						</Button>
					)}
			</Modal.Footer>
		</Modal.Root>
	);
});
