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

import * as ContextMenuActionCreators from '@app/actions/ContextMenuActionCreators';
import * as ModalActionCreators from '@app/actions/ModalActionCreators';
import {modal} from '@app/actions/ModalActionCreators';
import * as ScheduledEventActionCreators from '@app/actions/ScheduledEventActionCreators';
import * as TextCopyActionCreators from '@app/actions/TextCopyActionCreators';
import * as ToastActionCreators from '@app/actions/ToastActionCreators';
import channelItemStyles from '@app/components/layout/ChannelItem.module.css';
import {ChannelItemContent} from '@app/components/layout/ChannelItemContent';
import {GenericChannelItem} from '@app/components/layout/GenericChannelItem';
import {ConfirmModal} from '@app/components/modals/ConfirmModal';
import {CreateScheduledEventModal} from '@app/components/modals/CreateScheduledEventModal';
import {ScheduledEventDetailModal} from '@app/components/modals/ScheduledEventDetailModal';
import {CopyIdIcon, DeleteIcon} from '@app/components/uikit/context_menu/ContextMenuIcons';
import {MenuGroup} from '@app/components/uikit/context_menu/MenuGroup';
import {MenuItem} from '@app/components/uikit/context_menu/MenuItem';
import PermissionStore from '@app/stores/PermissionStore';
import ScheduledEventStore from '@app/stores/ScheduledEventStore';
import type {ScheduledEvent} from '@app/stores/ScheduledEventStore';
import {GuildScheduledEventStatus} from '@fluxer/constants/src/ScheduledEventConstants';
import {Permissions} from '@fluxer/constants/src/ChannelConstants';
import {CalendarIcon, CheckIcon, PlayIcon, PlusIcon, ShareIcon, UsersIcon, XCircleIcon} from '@phosphor-icons/react';
import {useLingui} from '@lingui/react/macro';
import {clsx} from 'clsx';
import {observer} from 'mobx-react-lite';
import {useEffect} from 'react';

interface ScheduledEventsBannerProps {
	guildId: string;
}

function formatEventTime(event: ScheduledEvent): string {
	const start = new Date(event.scheduled_start_time);
	const now = Date.now();
	const diff = start.getTime() - now;

	if (event.status === GuildScheduledEventStatus.ACTIVE) return 'Live now';
	if (diff < 0) return 'Started';
	if (diff < 3600000) return `In ${Math.ceil(diff / 60000)}m`;
	if (diff < 86400000) return `In ${Math.ceil(diff / 3600000)}h`;
	if (diff < 604800000) return `In ${Math.ceil(diff / 86400000)}d`;
	return start.toLocaleDateString(undefined, {month: 'short', day: 'numeric'});
}

export const ScheduledEventsBanner = observer(({guildId}: ScheduledEventsBannerProps) => {
	const {t, i18n} = useLingui();
	const upcoming = ScheduledEventStore.getUpcoming(guildId);
	const canManageEvents = PermissionStore.can(Permissions.MANAGE_EVENTS, {guildId});

	useEffect(() => {
		const pendingEvent = ScheduledEventStore.consumePendingEvent();
		if (pendingEvent) {
			ModalActionCreators.push(modal(() => <ScheduledEventDetailModal event={pendingEvent} />));
		}
	});

	if (upcoming.length === 0 && !canManageEvents) return null;

	const handleEventClick = (event: ScheduledEvent) => {
		ModalActionCreators.push(modal(() => <ScheduledEventDetailModal event={event} />));
	};

	const handleCreateEvent = () => {
		ModalActionCreators.push(modal(() => <CreateScheduledEventModal guildId={guildId} />));
	};

	const handleContextMenu = (e: React.MouseEvent, event: ScheduledEvent) => {
		e.preventDefault();
		e.stopPropagation();
		ContextMenuActionCreators.openFromEvent(e, ({onClose}) => (
			<>
				{canManageEvents && event.status === GuildScheduledEventStatus.SCHEDULED && (
					<MenuGroup>
						<MenuItem
							icon={<PlayIcon size={18} />}
							onClick={async () => {
								try {
									await ScheduledEventActionCreators.updateEvent(guildId, event.id, {status: GuildScheduledEventStatus.ACTIVE});
									ToastActionCreators.createToast({type: 'success', children: t`Event started`});
								} catch {}
								onClose();
							}}
						>
							{t`Start Event`}
						</MenuItem>
					</MenuGroup>
				)}
				<MenuGroup>
					<MenuItem
						icon={<CheckIcon size={18} />}
						onClick={async () => {
							const isInterested = ScheduledEventStore.isInterested(event.id);
							try {
								if (isInterested) {
									await ScheduledEventActionCreators.removeInterest(guildId, event.id);
								} else {
									await ScheduledEventActionCreators.markInterested(guildId, event.id);
								}
							} catch {}
							onClose();
						}}
					>
						{ScheduledEventStore.isInterested(event.id) ? t`Not Interested` : t`Interested`}
					</MenuItem>
					<MenuItem
						icon={<ShareIcon size={18} />}
						onClick={async () => {
							const link = `${window.location.origin}/channels/${guildId}?event=${event.id}`;
							await navigator.clipboard.writeText(link);
							ToastActionCreators.createToast({type: 'success', children: t`Event link copied`});
							onClose();
						}}
					>
						{t`Copy Event Link`}
					</MenuItem>
				</MenuGroup>
				{canManageEvents && (
					<MenuGroup>
						{event.status !== GuildScheduledEventStatus.COMPLETED && event.status !== GuildScheduledEventStatus.CANCELLED && (
							<MenuItem
								icon={<XCircleIcon size={18} />}
								danger
								onClick={() => {
									onClose();
									ModalActionCreators.push(
										modal(() => (
											<ConfirmModal
												title={t`Cancel Event`}
												description={t`Are you sure you want to cancel "${event.name}"?`}
												primaryText={t`Cancel Event`}
												primaryVariant="danger-primary"
												onPrimary={async () => {
													try {
														await ScheduledEventActionCreators.updateEvent(guildId, event.id, {status: GuildScheduledEventStatus.CANCELLED});
														ToastActionCreators.createToast({type: 'success', children: t`Event cancelled`});
													} catch {}
												}}
											/>
										)),
									);
								}}
							>
								{t`Cancel Event`}
							</MenuItem>
						)}
						<MenuItem
							icon={<DeleteIcon size={18} />}
							danger
							onClick={() => {
								onClose();
								ModalActionCreators.push(
									modal(() => (
										<ConfirmModal
											title={t`Delete Event`}
											description={t`Are you sure you want to delete "${event.name}"? This cannot be undone.`}
											primaryText={t`Delete Event`}
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
							}}
						>
							{t`Delete Event`}
						</MenuItem>
					</MenuGroup>
				)}
				<MenuGroup>
					<MenuItem
						icon={<CopyIdIcon size={18} />}
						onClick={async () => {
							await TextCopyActionCreators.copy(i18n, event.id, true);
							ToastActionCreators.createToast({type: 'success', children: t`Event ID copied`});
							onClose();
						}}
					>
						{t`Copy Event ID`}
					</MenuItem>
				</MenuGroup>
			</>
		));
	};

	return (
		<>
			{upcoming.map((event) => (
				<GenericChannelItem
					key={event.id}
					containerClassName={channelItemStyles.container}
					className={clsx(channelItemStyles.channelItem, channelItemStyles.channelItemRegular, channelItemStyles.channelItemHoverable)}
					onClick={() => handleEventClick(event)}
					onContextMenu={(e) => handleContextMenu(e, event)}
				>
					<ChannelItemContent
						icon={
							<CalendarIcon
								size={20}
								className={clsx(channelItemStyles.channelItemIcon, channelItemStyles.channelItemIconUnselected)}
								style={event.status === GuildScheduledEventStatus.ACTIVE ? {color: 'var(--status-positive)'} : undefined}
							/>
						}
						name={event.name}
						actions={
							<span style={{display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.6875rem', color: event.status === GuildScheduledEventStatus.ACTIVE ? 'var(--status-positive)' : 'var(--text-muted)', flexShrink: 0}}>
								{formatEventTime(event)}
								{event.user_count > 0 && (
									<>
										<UsersIcon size={11} />
										{event.user_count}
									</>
								)}
							</span>
						}
					/>
				</GenericChannelItem>
			))}
			{canManageEvents && (
				<GenericChannelItem
					containerClassName={channelItemStyles.container}
					className={clsx(channelItemStyles.channelItem, channelItemStyles.channelItemRegular, channelItemStyles.channelItemHoverable)}
					onClick={handleCreateEvent}
				>
					<ChannelItemContent
						icon={
							<PlusIcon
								size={20}
								className={clsx(channelItemStyles.channelItemIcon, channelItemStyles.channelItemIconUnselected)}
							/>
						}
						name={t`Create Event`}
					/>
				</GenericChannelItem>
			)}
		</>
	);
});
