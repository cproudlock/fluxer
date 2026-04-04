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
import * as ReadStateActionCreators from '@app/actions/ReadStateActionCreators';
import * as TextCopyActionCreators from '@app/actions/TextCopyActionCreators';
import * as ThreadActionCreators from '@app/actions/ThreadActionCreators';
import * as ToastActionCreators from '@app/actions/ToastActionCreators';
import * as UserGuildSettingsActionCreators from '@app/actions/UserGuildSettingsActionCreators';
import {ConfirmModal} from '@app/components/modals/ConfirmModal';
import {EditThreadTagsModal} from '@app/components/modals/EditThreadTagsModal';
import {
	CopyIdIcon,
	CopyLinkIcon,
	DeleteIcon,
	MarkAsReadIcon,
	MuteIcon,
} from '@app/components/uikit/context_menu/ContextMenuIcons';
import {MenuGroup} from '@app/components/uikit/context_menu/MenuGroup';
import {MenuItem} from '@app/components/uikit/context_menu/MenuItem';
import type {ChannelRecord} from '@app/records/ChannelRecord';
import ChannelStore from '@app/stores/ChannelStore';
import PermissionStore from '@app/stores/PermissionStore';
import ReadStateStore from '@app/stores/ReadStateStore';
import ThreadStore from '@app/stores/ThreadStore';
import UserGuildSettingsStore from '@app/stores/UserGuildSettingsStore';
import UserStore from '@app/stores/UserStore';
import {Permissions} from '@fluxer/constants/src/ChannelConstants';
import {ArchiveIcon, BookmarkSimpleIcon, TagIcon} from '@phosphor-icons/react';
import {useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import type React from 'react';

interface ThreadContextMenuProps {
	thread: ChannelRecord;
	onClose: () => void;
}

export const ThreadContextMenu: React.FC<ThreadContextMenuProps> = observer(({thread, onClose}) => {
	const {t, i18n} = useLingui();
	const canManageThreads = thread.guildId
		? PermissionStore.can(Permissions.MANAGE_THREADS, {guildId: thread.guildId})
		: false;
	const hasUnread = ReadStateStore.hasUnread(thread.id);
	const parentChannel = thread.parentId ? ChannelStore.getChannel(thread.parentId) : null;
	const isForumThread = parentChannel?.isGuildForum() ?? false;
	const hasTags = isForumThread && (parentChannel?.availableTags?.length ?? 0) > 0;
	const isMuted = thread.guildId ? UserGuildSettingsStore.isChannelMuted(thread.guildId, thread.id) : false;
	const isArchived = thread.threadMetadata?.archived ?? false;
	const currentUser = UserStore.getCurrentUser();
	const isThreadCreator = currentUser?.id === thread.ownerId;
	const canArchive = canManageThreads || isThreadCreator;
	const isFollowing = ThreadStore.isCurrentUserMember(thread.id);

	return (
		<>
			<MenuGroup>
				<MenuItem
					icon={<MarkAsReadIcon size={20} />}
					disabled={!hasUnread}
					onClick={() => {
						ReadStateActionCreators.ack(thread.id, true, true);
						onClose();
					}}
				>
					{t`Mark As Read`}
				</MenuItem>
			</MenuGroup>

			<MenuGroup>
				<MenuItem
					icon={<BookmarkSimpleIcon size={20} weight={isFollowing ? 'fill' : 'regular'} />}
					onClick={async () => {
						try {
							if (isFollowing) {
								await ThreadActionCreators.leaveThread(thread.id);
								ToastActionCreators.createToast({type: 'success', children: t`Unfollowed post`});
							} else {
								await ThreadActionCreators.joinThread(thread.id);
								ToastActionCreators.createToast({type: 'success', children: t`Following post`});
							}
						} catch {}
						onClose();
					}}
				>
					{isFollowing ? t`Unfollow Post` : t`Follow Post`}
				</MenuItem>
				{hasTags && (
					<MenuItem
						icon={<TagIcon size={20} />}
						onClick={() => {
							onClose();
							ModalActionCreators.push(modal(() => <EditThreadTagsModal thread={thread} />));
						}}
					>
						{t`Edit Tags`}
					</MenuItem>
				)}
				<MenuItem
					icon={<CopyLinkIcon size={20} />}
					onClick={async () => {
						const link = `${window.location.origin}/channels/${thread.guildId}/${thread.id}`;
						await navigator.clipboard.writeText(link);
						ToastActionCreators.createToast({type: 'success', children: t`Link copied`});
						onClose();
					}}
				>
					{t`Copy Link`}
				</MenuItem>
			</MenuGroup>

			<MenuGroup>
				<MenuItem
					icon={<MuteIcon size={20} />}
					onClick={() => {
						UserGuildSettingsActionCreators.toggleChannelMuted(thread.guildId ?? null, thread.id);
						ToastActionCreators.createToast({
							type: 'success',
							children: isMuted ? t`Post unmuted` : t`Post muted`,
						});
						onClose();
					}}
				>
					{isMuted ? t`Unmute Post` : t`Mute Post`}
				</MenuItem>
			</MenuGroup>

			<MenuGroup>
				<MenuItem
					icon={<CopyIdIcon size={20} />}
					onClick={async () => {
						await TextCopyActionCreators.copy(i18n, thread.id, true);
						ToastActionCreators.createToast({type: 'success', children: t`Thread ID copied`});
						onClose();
					}}
				>
					{t`Copy Thread ID`}
				</MenuItem>
			</MenuGroup>

			{canArchive && (
				<MenuGroup>
					<MenuItem
						icon={<ArchiveIcon size={20} />}
						onClick={async () => {
							try {
								await ThreadActionCreators.updateThread(thread.id, {archived: !isArchived});
								ToastActionCreators.createToast({
									type: 'success',
									children: isArchived ? t`Post unarchived` : t`Post archived`,
								});
							} catch {
								ToastActionCreators.createToast({type: 'error', children: t`Failed to update post`});
							}
							onClose();
						}}
					>
						{isArchived ? t`Unarchive Post` : t`Archive Post`}
					</MenuItem>
				</MenuGroup>
			)}

			{canManageThreads && (
				<MenuGroup>
					<MenuItem
						icon={<DeleteIcon size={20} />}
						danger
						onClick={() => {
							onClose();
							ModalActionCreators.push(
								modal(() => (
									<ConfirmModal
										title={t`Delete Thread`}
										description={t`Are you sure you want to delete "${thread.name}"? This action cannot be undone.`}
										primaryText={t`Delete Thread`}
										primaryVariant="danger-primary"
										onPrimary={async () => {
											try {
												await ThreadActionCreators.deleteThread(thread.id);
												ThreadStore.handleThreadDelete(thread.id);
												ChannelStore.handleChannelDelete({channel: {id: thread.id, guild_id: thread.guildId, type: thread.type}});
												ToastActionCreators.createToast({type: 'success', children: t`Thread deleted`});
											} catch {
												ToastActionCreators.createToast({type: 'error', children: t`Failed to delete thread`});
											}
										}}
									/>
								)),
							);
						}}
					>
						{t`Delete Thread`}
					</MenuItem>
				</MenuGroup>
			)}
		</>
	);
});
