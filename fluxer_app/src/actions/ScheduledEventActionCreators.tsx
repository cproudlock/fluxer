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

import {Endpoints} from '@app/Endpoints';
import http from '@app/lib/HttpClient';
import ScheduledEventStore from '@app/stores/ScheduledEventStore';
import type {ScheduledEvent} from '@app/stores/ScheduledEventStore';

export async function fetchEvents(guildId: string) {
	const response = await http.get<Array<ScheduledEvent>>({url: Endpoints.GUILD_SCHEDULED_EVENTS(guildId)});
	if (Array.isArray(response.body)) {
		ScheduledEventStore.setEvents(guildId, response.body);
	}
	return response.body;
}

export async function createEvent(
	guildId: string,
	data: {
		name: string;
		description?: string | null;
		scheduled_start_time: string;
		scheduled_end_time?: string | null;
		entity_type: number;
		channel_id?: string | null;
		location?: string | null;
	},
) {
	const response = await http.post<ScheduledEvent>({url: Endpoints.GUILD_SCHEDULED_EVENTS(guildId), body: data});
	return response.body;
}

export async function updateEvent(
	guildId: string,
	eventId: string,
	data: {
		name?: string;
		description?: string | null;
		scheduled_start_time?: string;
		scheduled_end_time?: string | null;
		entity_type?: number;
		channel_id?: string | null;
		location?: string | null;
		status?: number;
	},
) {
	const response = await http.patch<ScheduledEvent>({url: Endpoints.GUILD_SCHEDULED_EVENT(guildId, eventId), body: data});
	return response.body;
}

export async function deleteEvent(guildId: string, eventId: string) {
	await http.delete({url: Endpoints.GUILD_SCHEDULED_EVENT(guildId, eventId)});
}

export async function markInterested(guildId: string, eventId: string) {
	await http.put({url: Endpoints.GUILD_SCHEDULED_EVENT_USER_ME(guildId, eventId)});
}

export async function removeInterest(guildId: string, eventId: string) {
	await http.delete({url: Endpoints.GUILD_SCHEDULED_EVENT_USER_ME(guildId, eventId)});
}

export async function fetchInterestedUsers(guildId: string, eventId: string) {
	const response = await http.get({url: Endpoints.GUILD_SCHEDULED_EVENT_USERS(guildId, eventId)});
	return response.body;
}
