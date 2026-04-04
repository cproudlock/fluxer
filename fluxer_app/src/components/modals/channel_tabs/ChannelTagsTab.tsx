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

import * as ToastActionCreators from '@app/actions/ToastActionCreators';
import {Input} from '@app/components/form/Input';
import {ExpressionPickerSheet} from '@app/components/modals/ExpressionPickerSheet';
import {ExpressionPickerPopout} from '@app/components/popouts/ExpressionPickerPopout';
import {Button} from '@app/components/uikit/button/Button';
import {Popout} from '@app/components/uikit/popout/Popout';
import {Endpoints} from '@app/Endpoints';
import http from '@app/lib/HttpClient';
import ChannelStore from '@app/stores/ChannelStore';
import type {Channel} from '@fluxer/schema/src/domains/channel/ChannelSchemas';
import MobileLayoutStore from '@app/stores/MobileLayoutStore';
import type {FlatEmoji} from '@app/types/EmojiTypes';
import {getSkinTonedSurrogate} from '@app/utils/SkinToneUtils';
import {PlusIcon, SmileyIcon, TrashIcon} from '@phosphor-icons/react';
import {useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import {useCallback, useState} from 'react';

interface ForumTag {
	id: string;
	name: string;
	emoji_name: string | null;
}

const ChannelTagsTab = observer(({channelId}: {channelId: string}) => {
	const {t} = useLingui();
	const channel = ChannelStore.getChannel(channelId);
	const isMobile = MobileLayoutStore.enabled;
	const [tags, setTags] = useState<Array<ForumTag>>(() =>
		channel?.availableTags ? [...channel.availableTags] : [],
	);
	const [newTagName, setNewTagName] = useState('');
	const [newTagEmoji, setNewTagEmoji] = useState<string | null>(null);
	const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
	const [saving, setSaving] = useState(false);

	if (!channel) return null;

	const handleEmojiSelect = useCallback((emoji: FlatEmoji) => {
		if (emoji.id) {
			setNewTagEmoji(emoji.name);
		} else {
			setNewTagEmoji(getSkinTonedSurrogate(emoji));
		}
		setEmojiPickerOpen(false);
	}, []);

	const addTag = () => {
		const name = newTagName.trim();
		if (!name || tags.length >= 20) return;
		setTags([...tags, {id: `${Date.now()}${tags.length}`, name, emoji_name: newTagEmoji}]);
		setNewTagName('');
		setNewTagEmoji(null);
	};

	const removeTag = (id: string) => {
		setTags(tags.filter((t) => t.id !== id));
	};

	const save = async () => {
		setSaving(true);
		try {
			const payload = {
				available_tags: tags.map((tag) => ({
					id: tag.id,
					name: tag.name,
					emoji_name: tag.emoji_name ?? null,
				})),
			};
			const response = await http.patch<Channel>(Endpoints.CHANNEL(channelId), payload);
			if (response.body) {
				ChannelStore.handleChannelCreate({channel: response.body as Channel});
			}
			ToastActionCreators.createToast({type: 'success', children: t`Tags updated`});
		} catch (err) {
			console.error('Failed to save tags:', err);
			ToastActionCreators.createToast({type: 'error', children: t`Failed to update tags`});
		} finally {
			setSaving(false);
		}
	};

	const emojiButton = (
		<button
			onClick={() => setEmojiPickerOpen(!emojiPickerOpen)}
			style={{
				width: 40,
				height: 40,
				borderRadius: 4,
				border: 'none',
				background: 'var(--input-background)',
				cursor: 'pointer',
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
				fontSize: '1.25rem',
			}}
			type="button"
		>
			{newTagEmoji ?? <SmileyIcon size={22} color="var(--text-muted)" />}
		</button>
	);

	return (
		<div style={{padding: '1rem', maxWidth: 600}}>
			<h2 style={{fontSize: '1.25rem', fontWeight: 700, color: 'var(--header-primary)', marginBottom: '0.5rem'}}>
				{t`Forum Tags`}
			</h2>
			<p style={{fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1.5rem'}}>
				{t`Help people organize their posts into subcategories and filter searches.`}
			</p>

			<div style={{display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem'}}>
				{tags.map((tag) => (
					<div
						key={tag.id}
						style={{
							display: 'flex',
							alignItems: 'center',
							gap: '0.75rem',
							padding: '0.5rem 0.75rem',
							borderRadius: 8,
							background: 'var(--background-secondary)',
						}}
					>
						<span style={{fontSize: '1.125rem', flexShrink: 0, width: 24, textAlign: 'center'}}>
							{tag.emoji_name ?? '🏷️'}
						</span>
						<span style={{flex: 1, color: 'var(--text-normal)', fontWeight: 500}}>{tag.name}</span>
						<button
							onClick={() => removeTag(tag.id)}
							style={{
								background: 'none',
								border: 'none',
								color: 'var(--text-muted)',
								cursor: 'pointer',
								padding: '0.25rem',
								display: 'flex',
							}}
							aria-label={t`Remove tag`}
						>
							<TrashIcon size={18} />
						</button>
					</div>
				))}
				{tags.length === 0 && (
					<div style={{color: 'var(--text-muted)', fontSize: '0.875rem', fontStyle: 'italic'}}>
						{t`No tags yet. Add one below.`}
					</div>
				)}
			</div>

			{tags.length < 20 && (
				<div style={{display: 'flex', gap: '0.5rem', alignItems: 'flex-end', marginBottom: '1.5rem'}}>
					<div style={{display: 'flex', flexDirection: 'column', gap: '0.25rem'}}>
						<label style={{fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--header-secondary)'}}>
							{t`Emoji`}
						</label>
						{isMobile ? (
							emojiButton
						) : (
							<Popout
								position="bottom-start"
								animationType="none"
								offsetMainAxis={8}
								render={({onClose}) => (
									<ExpressionPickerPopout
										onEmojiSelect={(emoji) => {
											handleEmojiSelect(emoji);
											onClose();
										}}
										onClose={onClose}
									/>
								)}
							>
								{emojiButton}
							</Popout>
						)}
					</div>
					<div style={{flex: 1}}>
						<Input
							label={t`Tag Name`}
							value={newTagName}
							onChange={(e) => setNewTagName(e.target.value)}
							placeholder={t`e.g. Bug, Question, Discussion`}
							maxLength={20}
							onKeyDown={(e) => {
								if (e.key === 'Enter') {
									e.preventDefault();
									addTag();
								}
							}}
						/>
					</div>
					<Button
						onClick={addTag}
						disabled={!newTagName.trim()}
						variant="secondary"
						style={{flexShrink: 0, marginBottom: 2}}
					>
						<PlusIcon size={16} weight="bold" />
						{t`Add`}
					</Button>
				</div>
			)}

			{isMobile && (
				<ExpressionPickerSheet
					isOpen={emojiPickerOpen}
					onClose={() => setEmojiPickerOpen(false)}
					onEmojiSelect={(emoji) => handleEmojiSelect(emoji)}
					visibleTabs={['emojis']}
					channelId={channelId}
				/>
			)}

			<div style={{display: 'flex', justifyContent: 'flex-end'}}>
				<Button onClick={save} submitting={saving}>
					{t`Save Tags`}
				</Button>
			</div>
		</div>
	);
});

export default ChannelTagsTab;
