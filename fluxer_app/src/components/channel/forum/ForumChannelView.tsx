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
import * as ThreadActionCreators from '@app/actions/ThreadActionCreators';
import {ForumPostCard} from '@app/components/channel/forum/ForumPostCard';
import styles from '@app/components/channel/forum/ForumChannelView.module.css';
import {CreateForumPostModal} from '@app/components/modals/CreateForumPostModal';
import {ChannelRecord} from '@app/records/ChannelRecord';
import ChannelStore from '@app/stores/ChannelStore';
import ThreadStore from '@app/stores/ThreadStore';
import type {Channel} from '@fluxer/schema/src/domains/channel/ChannelSchemas';
import * as SnowflakeUtils from '@fluxer/snowflake/src/SnowflakeUtils';
import {ArchiveIcon, FunnelIcon, PlusIcon, SortAscendingIcon, XIcon} from '@phosphor-icons/react';
import {useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import {useCallback, useEffect, useMemo, useState} from 'react';

type SortMode = 'recent_activity' | 'date_posted';

interface ForumChannelViewProps {
	channel: ChannelRecord;
}

export const ForumChannelView = observer(({channel}: ForumChannelViewProps) => {
	const {t} = useLingui();
	const [searchQuery, setSearchQuery] = useState('');
	const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(new Set());
	const [sortMode, setSortMode] = useState<SortMode>('recent_activity');
	const [showArchived, setShowArchived] = useState(false);
	const [archivedThreads, setArchivedThreads] = useState<Array<ChannelRecord>>([]);
	const [archivedLoading, setArchivedLoading] = useState(false);

	const availableTags = channel.availableTags;

	const allChannels = ChannelStore.getGuildChannels(channel.guildId!);
	const threads = allChannels.filter(
		(ch) =>
			ch.isThread() &&
			ch.parentId === channel.id &&
			!ch.threadMetadata?.archived,
	);

	const fetchArchived = useCallback(async () => {
		if (archivedLoading) return;
		setArchivedLoading(true);
		try {
			const result = (await ThreadActionCreators.fetchArchivedThreads(channel.id)) as {threads?: Array<Channel>};
			if (result?.threads) {
				setArchivedThreads(result.threads.map((t) => new ChannelRecord(t)));
			}
		} catch {
			// ignore
		} finally {
			setArchivedLoading(false);
		}
	}, [channel.id, archivedLoading]);

	useEffect(() => {
		if (showArchived && archivedThreads.length === 0) {
			void fetchArchived();
		}
	}, [showArchived]);

	const filteredThreads = useMemo(() => {
		const source = showArchived ? archivedThreads : threads;
		let result = source;
		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase();
			result = result.filter((t) => t.name?.toLowerCase().includes(query));
		}
		if (selectedTagIds.size > 0) {
			result = result.filter((t) =>
				t.appliedTags.some((tagId) => selectedTagIds.has(tagId)),
			);
		}
		result = [...result].sort((a, b) => {
			if (sortMode === 'recent_activity') {
				const aTime = a.lastMessageId ? SnowflakeUtils.extractTimestamp(a.lastMessageId) : a.createdAt.getTime();
				const bTime = b.lastMessageId ? SnowflakeUtils.extractTimestamp(b.lastMessageId) : b.createdAt.getTime();
				return bTime - aTime;
			}
			return b.createdAt.getTime() - a.createdAt.getTime();
		});
		return result;
	}, [threads, archivedThreads, showArchived, searchQuery, selectedTagIds, sortMode]);

	const handleNewPost = () => {
		ModalActionCreators.push(modal(() => <CreateForumPostModal channelId={channel.id} />));
	};

	const handlePostClick = (threadId: string) => {
		ThreadStore.openThreadPanel(threadId);
	};

	const toggleTag = (tagId: string) => {
		setSelectedTagIds((prev) => {
			const next = new Set(prev);
			if (next.has(tagId)) {
				next.delete(tagId);
			} else {
				next.add(tagId);
			}
			return next;
		});
	};

	return (
		<div className={styles.container}>
			<div className={styles.header}>
				<input
					type="text"
					className={styles.searchInput}
					placeholder={t`Search or create a post...`}
					value={searchQuery}
					onChange={(e) => setSearchQuery(e.target.value)}
				/>
				<button
					className={styles.sortButton}
					onClick={() => setSortMode(sortMode === 'recent_activity' ? 'date_posted' : 'recent_activity')}
					title={sortMode === 'recent_activity' ? t`Sorted by Recent Activity` : t`Sorted by Date Posted`}
				>
					<SortAscendingIcon size={18} />
					<span className={styles.sortLabel}>
						{sortMode === 'recent_activity' ? t`Recent Activity` : t`Date Posted`}
					</span>
				</button>
				<button
					className={`${styles.sortButton} ${showArchived ? styles.archiveActive : ''}`}
					onClick={() => setShowArchived(!showArchived)}
					title={showArchived ? t`Show active posts` : t`Show archived posts`}
				>
					<ArchiveIcon size={18} />
					<span className={styles.sortLabel}>
						{showArchived ? t`Archived` : t`Active`}
					</span>
				</button>
				{!showArchived && (
					<button className={styles.newPostButton} onClick={handleNewPost}>
						<PlusIcon size={16} weight="bold" />
						{t`New Post`}
					</button>
				)}
			</div>
			{availableTags.length > 0 && (
				<div className={styles.tagFilter}>
					<FunnelIcon size={16} className={styles.tagFilterIcon} />
					{availableTags.map((tag) => (
						<button
							key={tag.id}
							className={`${styles.tagFilterButton} ${selectedTagIds.has(tag.id) ? styles.tagFilterActive : ''}`}
							onClick={() => toggleTag(tag.id)}
						>
							{tag.emoji_name && <span>{tag.emoji_name}</span>}
							{tag.name}
							{selectedTagIds.has(tag.id) && <XIcon size={12} />}
						</button>
					))}
				</div>
			)}
			<div className={styles.postList}>
				{archivedLoading && showArchived ? (
					<div className={styles.emptyState}>
						<div className={styles.emptyDescription}>{t`Loading archived posts...`}</div>
					</div>
				) : filteredThreads.length === 0 ? (
					<div className={styles.emptyState}>
						<div className={styles.emptyTitle}>
							{showArchived
								? t`No archived posts`
								: threads.length === 0
									? t`No posts yet`
									: t`No matching posts`}
						</div>
						<div className={styles.emptyDescription}>
							{showArchived
								? t`Posts that have been inactive will appear here.`
								: threads.length === 0
									? t`Be the first to start a discussion in this forum.`
									: t`Try a different search term.`}
						</div>
					</div>
				) : (
					filteredThreads.map((thread) => (
						<ForumPostCard
							key={thread.id}
							thread={thread}
							availableTags={availableTags}
							onClick={() => handlePostClick(thread.id)}
						/>
					))
				)}
			</div>
		</div>
	);
});
