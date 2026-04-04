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
import * as ThreadActionCreators from '@app/actions/ThreadActionCreators';
import * as ToastActionCreators from '@app/actions/ToastActionCreators';
import * as Modal from '@app/components/modals/Modal';
import {Button} from '@app/components/uikit/button/Button';
import type {ChannelRecord} from '@app/records/ChannelRecord';
import ChannelStore from '@app/stores/ChannelStore';
import {useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import {useState} from 'react';

interface EditThreadTagsModalProps {
	thread: ChannelRecord;
}

export const EditThreadTagsModal = observer(({thread}: EditThreadTagsModalProps) => {
	const {t} = useLingui();
	const [selectedTags, setSelectedTags] = useState<Set<string>>(() => new Set(thread.appliedTags));
	const [saving, setSaving] = useState(false);

	const parentChannel = thread.parentId ? ChannelStore.getChannel(thread.parentId) : null;
	const availableTags = parentChannel?.availableTags ?? [];

	const toggleTag = (tagId: string) => {
		setSelectedTags((prev) => {
			const next = new Set(prev);
			if (next.has(tagId)) {
				next.delete(tagId);
			} else if (next.size < 5) {
				next.add(tagId);
			}
			return next;
		});
	};

	const handleSave = async () => {
		setSaving(true);
		try {
			await ThreadActionCreators.updateThread(thread.id, {
				appliedTags: Array.from(selectedTags),
			});
			ToastActionCreators.createToast({type: 'success', children: t`Tags updated`});
			ModalActionCreators.pop();
		} catch {
			ToastActionCreators.createToast({type: 'error', children: t`Failed to update tags`});
		} finally {
			setSaving(false);
		}
	};

	if (availableTags.length === 0) {
		return (
			<Modal.Root size="small" centered>
				<Modal.Header title={t`Edit Tags`} />
				<Modal.Content>
					<p style={{color: 'var(--text-muted)', textAlign: 'center', padding: '1rem 0'}}>
						{t`No tags have been created for this forum yet. Add tags in the forum's channel settings.`}
					</p>
				</Modal.Content>
				<Modal.Footer>
					<Button onClick={ModalActionCreators.pop} variant="secondary">
						{t`Close`}
					</Button>
				</Modal.Footer>
			</Modal.Root>
		);
	}

	return (
		<Modal.Root size="small" centered>
			<Modal.Header title={t`Edit Tags`} />
			<Modal.Content>
				<p style={{fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1rem'}}>
					{t`Select tags for this post (up to 5).`}
				</p>
				<div style={{display: 'flex', flexWrap: 'wrap', gap: '0.5rem'}}>
					{availableTags.map((tag) => (
						<button
							key={tag.id}
							type="button"
							onClick={() => toggleTag(tag.id)}
							style={{
								display: 'inline-flex',
								alignItems: 'center',
								gap: '0.375rem',
								padding: '0.375rem 0.75rem',
								borderRadius: '99px',
								border: `1px solid ${selectedTags.has(tag.id) ? 'var(--brand-experiment)' : 'var(--background-modifier-accent)'}`,
								background: selectedTags.has(tag.id) ? 'var(--brand-experiment)' : 'transparent',
								color: selectedTags.has(tag.id) ? 'white' : 'var(--text-normal)',
								fontSize: '0.8125rem',
								fontWeight: 500,
								cursor: 'pointer',
								transition: 'background-color 0.1s, border-color 0.1s',
							}}
						>
							{tag.emoji_name && <span>{tag.emoji_name}</span>}
							{tag.name}
						</button>
					))}
				</div>
			</Modal.Content>
			<Modal.Footer>
				<Button onClick={ModalActionCreators.pop} variant="secondary">
					{t`Cancel`}
				</Button>
				<Button onClick={handleSave} submitting={saving}>
					{t`Save`}
				</Button>
			</Modal.Footer>
		</Modal.Root>
	);
});
