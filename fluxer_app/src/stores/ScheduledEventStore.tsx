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

import AuthenticationStore from '@app/stores/AuthenticationStore';
import {GuildScheduledEventStatus} from '@fluxer/constants/src/ScheduledEventConstants';
import {makeAutoObservable} from 'mobx';

export interface ScheduledEvent {
	id: string;
	guild_id: string;
	name: string;
	description: string | null;
	scheduled_start_time: string;
	scheduled_end_time: string | null;
	entity_type: number;
	status: number;
	channel_id: string | null;
	location: string | null;
	cover_image: string | null;
	creator_id: string;
	user_count: number;
	created_at: string;
}

// Capture event param before router redirects
const _pendingEventId = (() => {
	try {
		const params = new URLSearchParams(window.location.search);
		const eventId = params.get('event');
		if (eventId) {
			const url = new URL(window.location.href);
			url.searchParams.delete('event');
			window.history.replaceState({}, '', url.toString());
		}
		return eventId;
	} catch {
		return null;
	}
})();

class ScheduledEventStore {
	events = new Map<string, Array<ScheduledEvent>>();
	interestedUsers = new Map<string, Set<string>>();
	pendingEventId: string | null = _pendingEventId;

	constructor() {
		makeAutoObservable<ScheduledEventStore, never>(this, {}, {autoBind: true});
	}

	getEvents(guildId: string): Array<ScheduledEvent> {
		return this.events.get(guildId) ?? [];
	}

	getUpcoming(guildId: string): Array<ScheduledEvent> {
		return this.getEvents(guildId)
			.filter(
				(e) =>
					e.status === GuildScheduledEventStatus.SCHEDULED ||
					e.status === GuildScheduledEventStatus.ACTIVE,
			)
			.sort((a, b) => new Date(a.scheduled_start_time).getTime() - new Date(b.scheduled_start_time).getTime());
	}

	setEvents(guildId: string, events: Array<ScheduledEvent>) {
		this.events.set(guildId, events);
		if (this.pendingEventId) {
			const event = events.find((e) => e.id === this.pendingEventId);
			if (event) {
				this.pendingEventId = null;
				this._pendingEvent = event;
			}
		}
	}

	_pendingEvent: ScheduledEvent | null = null;

	consumePendingEvent(): ScheduledEvent | null {
		const event = this._pendingEvent;
		this._pendingEvent = null;
		return event;
	}

	handleEventCreate(event: ScheduledEvent) {
		const existing = this.events.get(event.guild_id) ?? [];
		if (!existing.some((e) => e.id === event.id)) {
			this.events.set(event.guild_id, [...existing, event]);
		}
	}

	handleEventUpdate(event: ScheduledEvent) {
		const existing = this.events.get(event.guild_id);
		if (existing) {
			this.events.set(
				event.guild_id,
				existing.map((e) => (e.id === event.id ? event : e)),
			);
		}
	}

	handleEventDelete(guildId: string, eventId: string) {
		const existing = this.events.get(guildId);
		if (existing) {
			this.events.set(
				guildId,
				existing.filter((e) => e.id !== eventId),
			);
		}
		this.interestedUsers.delete(eventId);
	}

	handleUserAdd(eventId: string, userId: string, guildId: string) {
		const interested = this.interestedUsers.get(eventId) ?? new Set();
		interested.add(userId);
		this.interestedUsers.set(eventId, interested);

		const existing = this.events.get(guildId);
		if (existing) {
			this.events.set(
				guildId,
				existing.map((e) => (e.id === eventId ? {...e, user_count: e.user_count + 1} : e)),
			);
		}
	}

	handleUserRemove(eventId: string, userId: string, guildId: string) {
		const interested = this.interestedUsers.get(eventId);
		if (interested) {
			interested.delete(userId);
			this.interestedUsers.set(eventId, interested);
		}

		const existing = this.events.get(guildId);
		if (existing) {
			this.events.set(
				guildId,
				existing.map((e) => (e.id === eventId ? {...e, user_count: Math.max(0, e.user_count - 1)} : e)),
			);
		}
	}

	isInterested(eventId: string): boolean {
		const userId = AuthenticationStore.currentUserId;
		if (!userId) return false;
		return this.interestedUsers.get(eventId)?.has(userId) ?? false;
	}

	reset() {
		this.events.clear();
		this.interestedUsers.clear();
	}
}

export default new ScheduledEventStore();
