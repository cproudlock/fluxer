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
import {Form} from '@app/components/form/Form';
import {Input} from '@app/components/form/Input';
import * as Modal from '@app/components/modals/Modal';
import {Button} from '@app/components/uikit/button/Button';
import {useFormSubmit} from '@app/hooks/useFormSubmit';
import ChannelStore from '@app/stores/ChannelStore';
import ThreadStore from '@app/stores/ThreadStore';
import {useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import {useState} from 'react';
import {useForm} from 'react-hook-form';

interface FormInputs {
	name: string;
	autoArchiveDuration: string;
}

export const CreateForumPostModal = observer(({channelId}: {channelId: string}) => {
	const {t} = useLingui();
	const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
	const channel = ChannelStore.getChannel(channelId);
	const availableTags = channel?.availableTags ?? [];

	const form = useForm<FormInputs>({
		defaultValues: {name: '', autoArchiveDuration: '4320'},
	});

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

	const onSubmit = async (data: FormInputs) => {
		const result = (await ThreadActionCreators.createThread(channelId, data.name, {
			autoArchiveDuration: Number(data.autoArchiveDuration),
			appliedTags: selectedTags.size > 0 ? Array.from(selectedTags) : undefined,
		})) as {id?: string} | undefined;
		ModalActionCreators.pop();
		if (result?.id) {
			ThreadStore.openThreadPanel(result.id);
		}
	};

	const {handleSubmit} = useFormSubmit({
		form,
		onSubmit,
		defaultErrorField: 'name',
	});

	return (
		<Modal.Root size="small" centered>
			<Form form={form} onSubmit={handleSubmit}>
				<Modal.Header title={t`New Post`} />
				<Modal.Content>
					<Input
						{...form.register('name')}
						autoComplete="off"
						autoFocus={true}
						error={form.formState.errors.name?.message}
						label={t`Post Title`}
						placeholder={t`Enter a post title`}
						maxLength={100}
					/>
					{availableTags.length > 0 && (
						<div style={{marginTop: '1rem'}}>
							<div style={{fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--header-secondary)', marginBottom: '0.5rem'}}>
								{t`Tags`}
							</div>
							<div style={{display: 'flex', flexWrap: 'wrap', gap: '0.375rem'}}>
								{availableTags.map((tag) => (
									<button
										key={tag.id}
										type="button"
										onClick={() => toggleTag(tag.id)}
										style={{
											display: 'inline-flex',
											alignItems: 'center',
											gap: '0.25rem',
											padding: '0.25rem 0.625rem',
											borderRadius: '99px',
											border: `1px solid ${selectedTags.has(tag.id) ? 'var(--brand-experiment)' : 'var(--background-modifier-accent)'}`,
											background: selectedTags.has(tag.id) ? 'var(--brand-experiment)' : 'transparent',
											color: selectedTags.has(tag.id) ? 'white' : 'var(--text-normal)',
											fontSize: '0.75rem',
											fontWeight: 500,
											cursor: 'pointer',
										}}
									>
										{tag.emoji_name && <span>{tag.emoji_name}</span>}
										{tag.name}
									</button>
								))}
							</div>
						</div>
					)}
					<div style={{marginTop: '1rem'}}>
						<label style={{display: 'block', marginBottom: '0.5rem', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--header-secondary)'}}>
							{t`Hide After Inactivity`}
						</label>
						<select
							{...form.register('autoArchiveDuration')}
							style={{width: '100%', padding: '0.5rem', borderRadius: '4px', border: 'none', background: 'var(--input-background)', color: 'var(--text-normal)', fontSize: '0.875rem'}}
						>
							<option value="60">{t`1 Hour`}</option>
							<option value="1440">{t`24 Hours`}</option>
							<option value="4320">{t`3 Days`}</option>
							<option value="10080">{t`1 Week`}</option>
							<option value="0">{t`Never`}</option>
						</select>
					</div>
				</Modal.Content>
				<Modal.Footer>
					<Button onClick={ModalActionCreators.pop} variant="secondary">
						{t`Cancel`}
					</Button>
					<Button type="submit" submitting={form.formState.isSubmitting}>
						{t`Create Post`}
					</Button>
				</Modal.Footer>
			</Form>
		</Modal.Root>
	);
});
