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

import * as ThreadActionCreators from '@app/actions/ThreadActionCreators';
import {ChannelHeaderIcon} from '@app/components/channel/channel_header_components/ChannelHeaderIcon';
import {Popout} from '@app/components/uikit/popout/Popout';
import {ChannelRecord} from '@app/records/ChannelRecord';
import ChannelStore from '@app/stores/ChannelStore';
import ThreadStore from '@app/stores/ThreadStore';
import type {Channel} from '@fluxer/schema/src/domains/channel/ChannelSchemas';
import {ArchiveIcon, ChatCircleIcon} from '@phosphor-icons/react';
import {useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import {useCallback, useEffect, useState} from 'react';

interface ChannelThreadsButtonProps {
	channel: ChannelRecord;
}

const ThreadsPopout = observer(({channel, onClose}: {channel: ChannelRecord; onClose: () => void}) => {
	const {t} = useLingui();
	const [showArchived, setShowArchived] = useState(false);
	const [archivedThreads, setArchivedThreads] = useState<Array<ChannelRecord>>([]);
	const [archivedLoading, setArchivedLoading] = useState(false);

	const allChannels = ChannelStore.getGuildChannels(channel.guildId!);
	const activeThreads = allChannels.filter(
		(ch) => ch.isThread() && ch.parentId === channel.id && !ch.threadMetadata?.archived,
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

	const threads = showArchived ? archivedThreads : activeThreads;

	return (
		<div style={{
			width: 300,
			maxHeight: 400,
			background: 'var(--background-floating)',
			borderRadius: 8,
			boxShadow: 'var(--shadow-high)',
			display: 'flex',
			flexDirection: 'column',
			overflow: 'hidden',
		}}>
			<div style={{
				display: 'flex',
				alignItems: 'center',
				padding: '12px 16px',
				borderBottom: '1px solid var(--background-modifier-accent)',
				gap: 8,
			}}>
				<h3 style={{flex: 1, margin: 0, fontSize: '0.875rem', fontWeight: 700, color: 'var(--header-primary)'}}>
					{t`Threads`}
				</h3>
				<button
					onClick={() => setShowArchived(!showArchived)}
					style={{
						display: 'flex',
						alignItems: 'center',
						gap: 4,
						padding: '4px 8px',
						borderRadius: 4,
						border: 'none',
						background: showArchived ? 'var(--brand-experiment)' : 'var(--background-secondary)',
						color: showArchived ? 'white' : 'var(--text-muted)',
						fontSize: '0.75rem',
						fontWeight: 500,
						cursor: 'pointer',
					}}
				>
					<ArchiveIcon size={14} />
					{showArchived ? t`Archived` : t`Active`}
				</button>
			</div>
			<div style={{flex: 1, overflowY: 'auto', padding: '4px 0'}}>
				{archivedLoading && showArchived ? (
					<div style={{padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8125rem'}}>
						{t`Loading...`}
					</div>
				) : threads.length === 0 ? (
					<div style={{padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8125rem'}}>
						{showArchived ? t`No archived threads` : t`No active threads`}
					</div>
				) : (
					threads.map((thread) => (
						<button
							key={thread.id}
							onClick={() => {
								ThreadStore.openThreadPanel(thread.id);
								onClose();
							}}
							style={{
								display: 'flex',
								alignItems: 'center',
								gap: 8,
								width: '100%',
								padding: '8px 16px',
								border: 'none',
								background: 'transparent',
								color: 'var(--text-normal)',
								fontSize: '0.8125rem',
								fontWeight: 500,
								cursor: 'pointer',
								textAlign: 'left',
							}}
							onMouseEnter={(e) => {
								e.currentTarget.style.background = 'var(--background-modifier-hover)';
							}}
							onMouseLeave={(e) => {
								e.currentTarget.style.background = 'transparent';
							}}
						>
							<ChatCircleIcon size={16} style={{flexShrink: 0, color: 'var(--text-muted)'}} />
							<span style={{overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
								{thread.name}
							</span>
							{thread.messageCount != null && thread.messageCount > 0 && (
								<span style={{marginLeft: 'auto', fontSize: '0.6875rem', color: 'var(--text-muted)', flexShrink: 0}}>
									{thread.messageCount} {thread.messageCount === 1 ? 'reply' : 'replies'}
								</span>
							)}
						</button>
					))
				)}
			</div>
		</div>
	);
});

export const ChannelThreadsButton = observer(({channel}: ChannelThreadsButtonProps) => {
	const {t} = useLingui();

	const allChannels = ChannelStore.getGuildChannels(channel.guildId!);
	const hasThreads = allChannels.some(
		(ch) => ch.isThread() && ch.parentId === channel.id && !ch.threadMetadata?.archived,
	);

	if (!hasThreads) return null;

	return (
		<Popout
			position="bottom-end"
			animationType="none"
			offsetMainAxis={8}
			render={({onClose}) => (
				<ThreadsPopout channel={channel} onClose={onClose} />
			)}
		>
			<ChannelHeaderIcon
				icon={ChatCircleIcon}
				label={t`Threads`}
			/>
		</Popout>
	);
});
