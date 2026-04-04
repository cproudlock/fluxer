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

import * as ScheduledEventActionCreators from '@app/actions/ScheduledEventActionCreators';
import * as ThreadActionCreators from '@app/actions/ThreadActionCreators';
import ChannelStore from '@app/stores/ChannelStore';
import EmojiStore from '@app/stores/EmojiStore';
import GuildAvailabilityStore from '@app/stores/GuildAvailabilityStore';
import GuildListStore from '@app/stores/GuildListStore';
import GuildMemberStore from '@app/stores/GuildMemberStore';
import GuildReadStateStore from '@app/stores/GuildReadStateStore';
import GuildStore from '@app/stores/GuildStore';
import GuildVerificationStore from '@app/stores/GuildVerificationStore';
import type {GatewayHandlerContext} from '@app/stores/gateway/handlers';
import {handleGuildDelete} from '@app/stores/gateway/handlers/guild/GuildDelete';
import MemberSearchStore from '@app/stores/MemberSearchStore';
import MemberSidebarStore from '@app/stores/MemberSidebarStore';
import MessageStore from '@app/stores/MessageStore';
import NagbarStore from '@app/stores/NagbarStore';
import PermissionStore from '@app/stores/PermissionStore';
import PresenceStore from '@app/stores/PresenceStore';
import QuickSwitcherStore from '@app/stores/QuickSwitcherStore';
import ReadStateStore from '@app/stores/ReadStateStore';
import SelectedGuildStore from '@app/stores/SelectedGuildStore';
import StickerStore from '@app/stores/StickerStore';
import UserGuildSettingsStore from '@app/stores/UserGuildSettingsStore';
import MediaEngineStore from '@app/stores/voice/MediaEngineFacade';
import type {GuildReadyData} from '@app/types/gateway/GatewayGuildTypes';
import {FAVORITES_GUILD_ID} from '@fluxer/constants/src/AppConstants';

function shouldTreatGuildCreateAsUnavailable(data: GuildReadyData): boolean {
	return (
		data.unavailable === true ||
		!Array.isArray(data.channels) ||
		!Array.isArray(data.members) ||
		!Array.isArray(data.roles) ||
		!Array.isArray(data.emojis)
	);
}

export function handleGuildCreate(data: GuildReadyData, _context: GatewayHandlerContext): void {
	if (shouldTreatGuildCreateAsUnavailable(data)) {
		handleGuildDelete({id: data.id, unavailable: true}, _context);
		return;
	}

	GuildAvailabilityStore.setGuildAvailable(data.id);
	GuildStore.handleGuildCreate(data);
	MemberSidebarStore.handleGuildCreate(data.id);

	if (data.channels.length > 0 && !data.unavailable) {
		ChannelStore.handleGuildCreate(data);
	}

	GuildMemberStore.handleGuildCreate(data);
	GuildReadStateStore.handleGuildCreate({guild: data});
	PresenceStore.handleGuildCreate(data);
	MediaEngineStore.handleGuildCreate(data);
	MessageStore.handleGuildCreate({guild: data});
	ReadStateStore.handleGuildCreate({guild: data});

	if (data.emojis.length > 0) {
		EmojiStore.handleGuildEmojiUpdated({guildId: data.id, emojis: data.emojis});
	}
	if (data.stickers && data.stickers.length > 0) {
		StickerStore.handleGuildStickersUpdate(data.id, data.stickers);
	}

	GuildListStore.handleGuild(data);
	StickerStore.handleGuildUpdate(data);
	NagbarStore.handleGuildUpdate({guild: data});
	EmojiStore.handleGuildUpdate({guild: data});
	PermissionStore.handleGuild();

	UserGuildSettingsStore.handleGuildCreate({id: data.id});
	GuildVerificationStore.handleGuildCreate({id: data.id});

	MemberSearchStore.handleGuildCreate(data.id);

	QuickSwitcherStore.recomputeIfOpen();

	// Fetch active threads for this guild (threads aren't included in GUILD_CREATE)
	void ThreadActionCreators.fetchActiveThreads(data.id).then((result: any) => {
		if (result?.threads && Array.isArray(result.threads)) {
			for (const thread of result.threads) {
				ChannelStore.handleChannelCreate({channel: thread});
			}
		}
	}).catch(() => {});

	// Fetch scheduled events for this guild
	console.log('[ScheduledEvents] Fetching events for guild', data.id);
	void ScheduledEventActionCreators.fetchEvents(data.id).then(() => {
		console.log('[ScheduledEvents] Events fetched successfully for guild', data.id);
	}).catch((err) => {
		console.warn('[ScheduledEvents] Failed to fetch events for guild', data.id, err);
	});

	const isSync = (_context as {_isSync?: boolean})._isSync;
	const selectedId = SelectedGuildStore.selectedGuildId;

	if (!isSync && selectedId === data.id && selectedId !== FAVORITES_GUILD_ID) {
		_context.socket?.updateGuildSubscriptions({
			subscriptions: {
				[data.id]: {
					active: true,
					sync: true,
				},
			},
		});
	}
}
