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

/** @jsxRuntime automatic */
/** @jsxImportSource hono/jsx */

import {hasPermission} from '@fluxer/admin/src/AccessControlList';
import {getErrorMessage} from '@fluxer/admin/src/api/Errors';
import {listGuildSoundboardSounds} from '@fluxer/admin/src/api/GuildAssets';
import {ErrorCard} from '@fluxer/admin/src/components/ErrorDisplay';
import {HStack} from '@fluxer/admin/src/components/ui/Layout/HStack';
import {VStack} from '@fluxer/admin/src/components/ui/Layout/VStack';
import {Stack} from '@fluxer/admin/src/components/ui/Stack';
import {Caption, Heading, Text} from '@fluxer/admin/src/components/ui/Typography';
import type {Session} from '@fluxer/admin/src/types/App';
import type {AdminConfig as Config} from '@fluxer/admin/src/types/Config';
import {AdminACLs} from '@fluxer/constants/src/AdminACLs';
import type {GuildSoundboardSoundResponse} from '@fluxer/schema/src/domains/guild/GuildSoundboardSchemas';
import {Button} from '@fluxer/ui/src/components/Button';
import {Card} from '@fluxer/ui/src/components/Card';
import {CsrfInput} from '@fluxer/ui/src/components/CsrfInput';
import type {FC} from 'hono/jsx';

interface SoundboardTabProps {
	config: Config;
	session: Session;
	guildId: string;
	adminAcls: Array<string>;
	csrfToken: string;
}

const RenderPermissionNotice: FC = () => (
	<Card padding="md">
		<Stack gap="md">
			<Heading level={2} size="base">
				Permission required
			</Heading>
			<Text size="sm" color="muted">
				You need the {AdminACLs.ASSET_PURGE} ACL to manage guild soundboard sounds.
			</Text>
		</Stack>
	</Card>
);

const RenderSoundCard: FC<{config: Config; guildId: string; sound: GuildSoundboardSoundResponse; csrfToken: string}> = ({
	config,
	guildId,
	sound,
	csrfToken,
}) => {
	return (
		<Card padding="none" class="overflow-hidden shadow-sm">
			<VStack gap={0}>
				<VStack gap={0} class="h-20 items-center justify-center bg-neutral-100 p-4">
					<span class="text-4xl">{sound.emoji ?? '🔊'}</span>
				</VStack>
				<VStack gap={1} class="flex-1 px-4 py-3">
					<HStack gap={2} justify="between" align="center">
						<Text size="sm" weight="semibold">
							{sound.name}
						</Text>
					</HStack>
					<Caption>ID: {sound.id}</Caption>
					<Caption>Duration: {(sound.duration_ms / 1000).toFixed(1)}s &middot; Vol: {Math.round(sound.volume * 100)}%</Caption>
					<a href={`${config.basePath}/users/${sound.uploaded_by}`} class="text-blue-600 text-xs hover:underline">
						Uploader: {sound.uploaded_by}
					</a>
					<form
						action={`${config.basePath}/guilds/${guildId}?tab=soundboard&action=delete_sound`}
						method="post"
						class="mt-4"
					>
						<CsrfInput token={csrfToken} />
						<input type="hidden" name="sound_id" value={sound.id} />
						<Button type="submit" variant="danger" size="small" fullWidth>
							Delete Sound
						</Button>
					</form>
				</VStack>
			</VStack>
		</Card>
	);
};

const RenderSounds: FC<{config: Config; guildId: string; sounds: Array<GuildSoundboardSoundResponse>; csrfToken: string}> = ({
	config,
	guildId,
	sounds,
	csrfToken,
}) => {
	return (
		<Card padding="md">
			<Stack gap="md">
				<Heading level={2} size="base">
					Soundboard ({sounds.length})
				</Heading>
				{sounds.length === 0 ? (
					<Text size="sm" color="muted">
						No soundboard sounds found for this guild.
					</Text>
				) : (
					<div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
						{sounds.map((sound) => (
							<RenderSoundCard config={config} guildId={guildId} sound={sound} csrfToken={csrfToken} />
						))}
					</div>
				)}
			</Stack>
		</Card>
	);
};

export async function SoundboardTab({config, session, guildId, adminAcls, csrfToken}: SoundboardTabProps) {
	const hasAssetPurge = hasPermission(adminAcls, AdminACLs.ASSET_PURGE);

	if (!hasAssetPurge) {
		return <RenderPermissionNotice />;
	}

	const result = await listGuildSoundboardSounds(config, session, guildId);

	if (!result.ok) {
		return (
			<VStack gap={4}>
				<ErrorCard title="Error" message={getErrorMessage(result.error)} />
				<a
					href={`${config.basePath}/guilds/${guildId}?tab=soundboard`}
					class="inline-block rounded bg-neutral-900 px-4 py-2 font-medium text-sm text-white transition-colors hover:bg-neutral-800"
				>
					Back to Guild
				</a>
			</VStack>
		);
	}

	return <RenderSounds config={config} guildId={guildId} sounds={result.data} csrfToken={csrfToken} />;
}
