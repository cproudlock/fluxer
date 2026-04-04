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
import {CreateScheduledEventModal} from '@app/components/modals/CreateScheduledEventModal';
import {ScheduledEventDetailModal} from '@app/components/modals/ScheduledEventDetailModal';
import {Button} from '@app/components/uikit/button/Button';
import ScheduledEventStore from '@app/stores/ScheduledEventStore';
import type {ScheduledEvent} from '@app/stores/ScheduledEventStore';
import {GuildScheduledEventEntityType, GuildScheduledEventStatus} from '@fluxer/constants/src/ScheduledEventConstants';
import {CalendarIcon, MapPinIcon, SpeakerHighIcon, TrashIcon} from '@phosphor-icons/react';
import {useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';

function getStatusLabel(status: number): string {
	switch (status) {
		case GuildScheduledEventStatus.SCHEDULED: return 'Scheduled';
		case GuildScheduledEventStatus.ACTIVE: return 'Live';
		case GuildScheduledEventStatus.COMPLETED: return 'Completed';
		case GuildScheduledEventStatus.CANCELLED: return 'Cancelled';
		default: return '';
	}
}

function getStatusColor(status: number): string {
	switch (status) {
		case GuildScheduledEventStatus.ACTIVE: return 'var(--status-positive)';
		case GuildScheduledEventStatus.COMPLETED:
		case GuildScheduledEventStatus.CANCELLED: return 'var(--text-muted)';
		default: return 'var(--brand-experiment)';
	}
}

const ScheduledEventsSettingsTab = observer(({guildId}: {guildId: string}) => {
	const {t} = useLingui();
	const allEvents = ScheduledEventStore.getEvents(guildId);
	const upcoming = allEvents.filter((e) => e.status === GuildScheduledEventStatus.SCHEDULED || e.status === GuildScheduledEventStatus.ACTIVE);
	const past = allEvents.filter((e) => e.status === GuildScheduledEventStatus.COMPLETED || e.status === GuildScheduledEventStatus.CANCELLED);

	const handleCreate = () => {
		ModalActionCreators.push(modal(() => <CreateScheduledEventModal guildId={guildId} />));
	};

	const handleDelete = (event: ScheduledEvent) => {
		ModalActionCreators.push(
			modal(() => (
				<ConfirmModal
					title={t`Delete Event`}
					description={t`Are you sure you want to delete "${event.name}"?`}
					primaryText={t`Delete`}
					primaryVariant="danger-primary"
					onPrimary={async () => {
						try {
							await ScheduledEventActionCreators.deleteEvent(guildId, event.id);
							ToastActionCreators.createToast({type: 'success', children: t`Event deleted`});
						} catch {}
					}}
				/>
			)),
		);
	};

	const renderEvent = (event: ScheduledEvent) => (
		<div
			key={event.id}
			onClick={() => ModalActionCreators.push(modal(() => <ScheduledEventDetailModal event={event} />))}
			style={{
				display: 'flex',
				alignItems: 'center',
				gap: 12,
				padding: '10px 12px',
				borderRadius: 8,
				background: 'var(--background-secondary)',
				cursor: 'pointer',
			}}
		>
			<CalendarIcon size={20} style={{color: getStatusColor(event.status), flexShrink: 0}} />
			<div style={{flex: 1, minWidth: 0}}>
				<div style={{fontWeight: 600, color: 'var(--header-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
					{event.name}
				</div>
				<div style={{fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 8}}>
					<span style={{color: getStatusColor(event.status), fontWeight: 600}}>{getStatusLabel(event.status)}</span>
					<span>{new Date(event.scheduled_start_time).toLocaleDateString(undefined, {month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'})}</span>
					{event.entity_type === GuildScheduledEventEntityType.VOICE && (
						<span style={{display: 'flex', alignItems: 'center', gap: 2}}><SpeakerHighIcon size={12} /> Voice</span>
					)}
					{event.entity_type === GuildScheduledEventEntityType.EXTERNAL && event.location && (
						<span style={{display: 'flex', alignItems: 'center', gap: 2}}><MapPinIcon size={12} /> {event.location}</span>
					)}
					<span>{event.user_count} interested</span>
				</div>
			</div>
			<button
				onClick={(e) => {
					e.stopPropagation();
					handleDelete(event);
				}}
				style={{background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4, display: 'flex', flexShrink: 0}}
			>
				<TrashIcon size={18} />
			</button>
		</div>
	);

	return (
		<div style={{padding: '1rem', maxWidth: 700}}>
			<div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem'}}>
				<h2 style={{fontSize: '1.25rem', fontWeight: 700, color: 'var(--header-primary)', margin: 0}}>
					{t`Scheduled Events`}
				</h2>
				<Button onClick={handleCreate}>
					{t`Create Event`}
				</Button>
			</div>

			{upcoming.length > 0 && (
				<div style={{marginBottom: '1.5rem'}}>
					<h3 style={{fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--header-secondary)', marginBottom: '0.5rem'}}>
						{t`Upcoming`} — {upcoming.length}
					</h3>
					<div style={{display: 'flex', flexDirection: 'column', gap: 6}}>
						{upcoming.map(renderEvent)}
					</div>
				</div>
			)}

			{past.length > 0 && (
				<div>
					<h3 style={{fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--header-secondary)', marginBottom: '0.5rem'}}>
						{t`Past Events`} — {past.length}
					</h3>
					<div style={{display: 'flex', flexDirection: 'column', gap: 6}}>
						{past.map(renderEvent)}
					</div>
				</div>
			)}

			{allEvents.length === 0 && (
				<div style={{textAlign: 'center', padding: '3rem 0', color: 'var(--text-muted)'}}>
					<CalendarIcon size={48} style={{marginBottom: '1rem', opacity: 0.5}} />
					<div style={{fontSize: '1rem', fontWeight: 600, color: 'var(--header-primary)', marginBottom: '0.5rem'}}>
						{t`No events yet`}
					</div>
					<div style={{fontSize: '0.875rem'}}>
						{t`Create an event to get started.`}
					</div>
				</div>
			)}
		</div>
	);
});

export default ScheduledEventsSettingsTab;
