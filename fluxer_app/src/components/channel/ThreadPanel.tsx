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
import * as MessageActionCreators from '@app/actions/MessageActionCreators';
import * as ModalActionCreators from '@app/actions/ModalActionCreators';
import {modal} from '@app/actions/ModalActionCreators';
import * as TextCopyActionCreators from '@app/actions/TextCopyActionCreators';
import * as ThreadActionCreators from '@app/actions/ThreadActionCreators';
import * as ToastActionCreators from '@app/actions/ToastActionCreators';
import {ChannelChatLayout} from '@app/components/channel/ChannelChatLayout';
import {ChannelTextarea} from '@app/components/channel/ChannelTextarea';
import {Messages} from '@app/components/channel/Messages';
import styles from '@app/components/channel/ThreadPanel.module.css';
import {ChannelPinsButton} from '@app/components/channel/channel_header_components/ChannelPinsButton';
import {ConfirmModal} from '@app/components/modals/ConfirmModal';
import {CopyIdIcon, CopyLinkIcon, DeleteIcon} from '@app/components/uikit/context_menu/ContextMenuIcons';
import {MenuGroup} from '@app/components/uikit/context_menu/MenuGroup';
import {MenuItem} from '@app/components/uikit/context_menu/MenuItem';
import ChannelStore from '@app/stores/ChannelStore';
import NavigationStore from '@app/stores/NavigationStore';
import PermissionStore from '@app/stores/PermissionStore';
import ThreadStore from '@app/stores/ThreadStore';
import UserStore from '@app/stores/UserStore';
import {Permissions} from '@fluxer/constants/src/ChannelConstants';
import {ArchiveIcon, ArrowsOutIcon, BookmarkSimpleIcon, DotsThreeIcon, UsersIcon, XIcon} from '@phosphor-icons/react';
import {useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import {useEffect} from 'react';

export const ThreadPanel = observer(() => {
	const {t, i18n} = useLingui();
	const threadId = ThreadStore.activeThreadPanel;
	if (!threadId) return null;

	const thread = ChannelStore.getChannel(threadId);
	if (!thread) return null;

	const parentChannel = thread.parentId ? ChannelStore.getChannel(thread.parentId) : null;
	const canManageThreads = thread.guildId
		? PermissionStore.can(Permissions.MANAGE_THREADS, {guildId: thread.guildId})
		: false;
	const currentUser = UserStore.getCurrentUser();
	const isThreadCreator = currentUser?.id === thread.ownerId;
	const canArchive = canManageThreads || isThreadCreator;
	const isArchived = thread.threadMetadata?.archived ?? false;
	const isFollowing = ThreadStore.isCurrentUserMember(thread.id);

	useEffect(() => {
		void ThreadActionCreators.fetchThreadMembers(thread.id).then((members: any) => {
			if (Array.isArray(members)) {
				ThreadStore.handleThreadMembersUpdate(
					thread.id,
					members.map((m: any) => ({id: m.id, userId: m.user_id, joinTimestamp: m.join_timestamp, flags: m.flags})),
				);
			}
		});
	}, [thread.id]);

	useEffect(() => {
		void MessageActionCreators.fetchMessages(threadId, null, null, 50);
	}, [threadId]);

	return (
		<div className={styles.container}>
			<div className={styles.header}>
				<div className={styles.headerLeft}>
					<div className={styles.threadName}>{thread.name}</div>
					{parentChannel && <div className={styles.parentChannel}>#{parentChannel.name}</div>}
				</div>
				<div className={styles.headerRight}>
					<ChannelPinsButton channel={thread} />
					<button
						className={styles.headerButton}
						aria-label={t`More options`}
						onClick={(e) => {
							ContextMenuActionCreators.openFromEvent(e, ({onClose}) => (
								<>
								<MenuGroup>
										<MenuItem
											icon={<UsersIcon size={18} />}
											onClick={() => {
												const members = ThreadStore.getThreadMembers(thread.id);
												const names = members
													.map((m) => UserStore.getUser(m.userId)?.displayName ?? m.userId)
													.join(', ');
												ToastActionCreators.createToast({
													type: 'info',
													children: members.length > 0
														? `${members.length} member${members.length !== 1 ? 's' : ''}: ${names}`
														: t`No members`,
												});
												onClose();
											}}
										>
											{t`View Members`}
										</MenuItem>
									</MenuGroup>
									<MenuGroup>
										<MenuItem
											icon={<ArrowsOutIcon size={18} />}
											onClick={() => {
												if (thread.guildId) {
													NavigationStore.navigateToGuild(thread.guildId, thread.id);
												}
												onClose();
											}}
										>
											{t`Open in Full View`}
										</MenuItem>
										<MenuItem
											icon={<BookmarkSimpleIcon size={18} weight={isFollowing ? 'fill' : 'regular'} />}
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
										<MenuItem
											icon={<CopyLinkIcon size={18} />}
											onClick={async () => {
												const link = `${window.location.origin}/channels/${thread.guildId}/${thread.id}`;
												await navigator.clipboard.writeText(link);
												ToastActionCreators.createToast({type: 'success', children: t`Link copied`});
												onClose();
											}}
										>
											{t`Copy Link`}
										</MenuItem>
										<MenuItem
											icon={<CopyIdIcon size={18} />}
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
												icon={<ArchiveIcon size={18} />}
												onClick={async () => {
													try {
														await ThreadActionCreators.updateThread(thread.id, {archived: !isArchived});
														ToastActionCreators.createToast({
															type: 'success',
															children: isArchived ? t`Post unarchived` : t`Post archived`,
														});
														if (!isArchived) ThreadStore.closeThreadPanel();
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
												icon={<DeleteIcon size={18} />}
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
																		ThreadStore.closeThreadPanel();
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
							));
						}}
					>
						<DotsThreeIcon size={20} weight="bold" />
					</button>
					<button className={styles.headerButton} onClick={ThreadStore.closeThreadPanel} aria-label={t`Close thread`}>
						<XIcon size={20} />
					</button>
				</div>
			</div>
			<div className={styles.content}>
				<ChannelChatLayout
					channel={thread}
					messages={<Messages key={threadId} channel={thread} />}
					textarea={<ChannelTextarea channel={thread} />}
				/>
			</div>
		</div>
	);
});
