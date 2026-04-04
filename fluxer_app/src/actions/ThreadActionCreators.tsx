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

export async function createThread(channelId: string, name: string, options?: {autoArchiveDuration?: number; type?: number; appliedTags?: Array<string>}) {
	const response = await http.post({
		url: Endpoints.CHANNEL_THREADS(channelId),
		body: {
			name,
			auto_archive_duration: options?.autoArchiveDuration,
			type: options?.type,
			applied_tags: options?.appliedTags,
		},
	});
	return response.body;
}

export async function updateThread(
	threadId: string,
	updates: {
		name?: string;
		archived?: boolean;
		autoArchiveDuration?: number;
		locked?: boolean;
		invitable?: boolean;
		rateLimitPerUser?: number;
		appliedTags?: Array<string>;
	},
) {
	const response = await http.patch({
		url: Endpoints.CHANNEL_THREAD(threadId),
		body: {
			name: updates.name,
			archived: updates.archived,
			auto_archive_duration: updates.autoArchiveDuration,
			locked: updates.locked,
			invitable: updates.invitable,
			rate_limit_per_user: updates.rateLimitPerUser,
			applied_tags: updates.appliedTags,
		},
	});
	return response.body;
}

export async function deleteThread(threadId: string) {
	await http.delete({url: Endpoints.CHANNEL_THREAD(threadId)});
}

export async function joinThread(threadId: string) {
	await http.put({url: Endpoints.CHANNEL_THREAD_MEMBERS_ME(threadId)});
}

export async function leaveThread(threadId: string) {
	await http.delete({url: Endpoints.CHANNEL_THREAD_MEMBERS_ME(threadId)});
}

export async function addThreadMember(threadId: string, userId: string) {
	await http.put({url: Endpoints.CHANNEL_THREAD_MEMBER(threadId, userId)});
}

export async function removeThreadMember(threadId: string, userId: string) {
	await http.delete({url: Endpoints.CHANNEL_THREAD_MEMBER(threadId, userId)});
}

export async function fetchThreadMembers(threadId: string) {
	const response = await http.get({url: Endpoints.CHANNEL_THREAD_MEMBERS(threadId)});
	return response.body;
}

export async function fetchActiveThreads(guildId: string) {
	const response = await http.get({url: Endpoints.GUILD_THREADS_ACTIVE(guildId)});
	return response.body;
}

export async function fetchArchivedThreads(channelId: string) {
	const response = await http.get({url: Endpoints.CHANNEL_THREADS_ARCHIVED_PUBLIC(channelId)});
	return response.body;
}
