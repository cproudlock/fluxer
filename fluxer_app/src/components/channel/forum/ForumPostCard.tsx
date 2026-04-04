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
import styles from '@app/components/channel/forum/ForumPostCard.module.css';
import {ThreadContextMenu} from '@app/components/uikit/context_menu/ThreadContextMenu';
import type {ChannelRecord} from '@app/records/ChannelRecord';
import MessageStore from '@app/stores/MessageStore';
import UserStore from '@app/stores/UserStore';
import {ChatCircleIcon, ClockIcon} from '@phosphor-icons/react';
import {useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import {useEffect} from 'react';
import * as SnowflakeUtils from '@fluxer/snowflake/src/SnowflakeUtils';

interface ForumTag {
	readonly id: string;
	readonly name: string;
	readonly emoji_name: string | null;
}

interface ForumPostCardProps {
	thread: ChannelRecord;
	availableTags?: ReadonlyArray<ForumTag>;
	onClick: () => void;
}

function formatRelativeTime(date: Date): string {
	const now = Date.now();
	const diff = now - date.getTime();
	const minutes = Math.floor(diff / 60000);
	if (minutes < 1) return 'just now';
	if (minutes < 60) return `${minutes}m ago`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h ago`;
	const days = Math.floor(hours / 24);
	if (days < 30) return `${days}d ago`;
	return date.toLocaleDateString();
}

export const ForumPostCard = observer(({thread, availableTags, onClick}: ForumPostCardProps) => {
	const {t} = useLingui();
	const author = thread.ownerId ? UserStore.getUser(thread.ownerId) : null;
	const replyCount = thread.messageCount ?? 0;
	const lastActivity = thread.lastMessageId
		? new Date(SnowflakeUtils.extractTimestamp(thread.lastMessageId))
		: thread.createdAt;

	const resolvedTags = (availableTags && thread.appliedTags.length > 0)
		? thread.appliedTags
			.map((tagId) => availableTags.find((t) => t.id === tagId))
			.filter((t): t is ForumTag => t != null)
		: [];

	// Fetch first message for preview if not already cached
	const messages = MessageStore.getMessages(thread.id);
	const firstMessage = messages?.first();

	useEffect(() => {
		if (!firstMessage && (thread.messageCount ?? 0) > 0) {
			void MessageActionCreators.fetchMessages(thread.id, null, null, 1);
		}
	}, [thread.id, firstMessage, thread.messageCount]);

	const previewText = firstMessage?.content
		? firstMessage.content.length > 150
			? `${firstMessage.content.slice(0, 150)}...`
			: firstMessage.content
		: null;

	return (
		<div
			className={styles.card}
			onClick={onClick}
			onContextMenu={(e) => {
				e.preventDefault();
				e.stopPropagation();
				ContextMenuActionCreators.openFromEvent(e, ({onClose}) => (
					<ThreadContextMenu thread={thread} onClose={onClose} />
				));
			}}
			role="button"
			tabIndex={0}
		>
			<div className={styles.title}>{thread.name}</div>
			{previewText && <div className={styles.preview}>{previewText}</div>}
			{resolvedTags.length > 0 && (
				<div className={styles.tags}>
					{resolvedTags.map((tag) => (
						<span key={tag.id} className={styles.tag}>
							{tag.emoji_name && <span className={styles.tagEmoji}>{tag.emoji_name}</span>}
							{tag.name}
						</span>
					))}
				</div>
			)}
			<div className={styles.meta}>
				{author && (
					<span className={styles.author}>
						<span className={styles.authorName}>{author.displayName}</span>
					</span>
				)}
				<span className={styles.stat}>
					<ChatCircleIcon size={14} />
					{replyCount} {replyCount === 1 ? t`reply` : t`replies`}
				</span>
				<span className={styles.stat}>
					<ClockIcon size={14} />
					{formatRelativeTime(lastActivity)}
				</span>
			</div>
		</div>
	);
});
