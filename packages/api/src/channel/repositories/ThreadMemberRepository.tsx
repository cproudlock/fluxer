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

import type {ChannelID, UserID} from '@fluxer/api/src/BrandedTypes';
import {BatchBuilder, fetchMany, fetchOne} from '@fluxer/api/src/database/Cassandra';
import type {ThreadMemberByUserRow, ThreadMemberRow} from '@fluxer/api/src/database/types/ThreadTypes';
import {ThreadMembers, ThreadMembersByUser} from '@fluxer/api/src/Tables';

const FETCH_THREAD_MEMBER = ThreadMembers.select({
	where: [ThreadMembers.where.eq('thread_id'), ThreadMembers.where.eq('user_id')],
	limit: 1,
});

const FETCH_THREAD_MEMBERS = ThreadMembers.select({
	where: ThreadMembers.where.eq('thread_id'),
});

const FETCH_USER_THREADS = ThreadMembersByUser.select({
	where: ThreadMembersByUser.where.eq('user_id'),
});

export class ThreadMemberRepository {
	async addMember(threadId: ChannelID, userId: UserID, flags: number = 0): Promise<ThreadMemberRow> {
		const now = new Date();
		const row: ThreadMemberRow = {
			thread_id: threadId,
			user_id: userId,
			join_timestamp: now,
			flags,
		};

		const batch = new BatchBuilder();
		batch.addPrepared(
			ThreadMembers.upsertAll({
				thread_id: threadId,
				user_id: userId,
				join_timestamp: now,
				flags,
			}),
		);
		batch.addPrepared(
			ThreadMembersByUser.upsertAll({
				user_id: userId,
				thread_id: threadId,
				join_timestamp: now,
			}),
		);
		await batch.execute();

		return row;
	}

	async removeMember(threadId: ChannelID, userId: UserID): Promise<void> {
		const batch = new BatchBuilder();
		batch.addPrepared(
			ThreadMembers.deleteByPk({
				thread_id: threadId,
				user_id: userId,
			}),
		);
		batch.addPrepared(
			ThreadMembersByUser.deleteByPk({
				user_id: userId,
				thread_id: threadId,
			}),
		);
		await batch.execute();
	}

	async listMembers(threadId: ChannelID): Promise<Array<ThreadMemberRow>> {
		return fetchMany<ThreadMemberRow>(
			FETCH_THREAD_MEMBERS.bind({thread_id: threadId}),
		);
	}

	async isMember(threadId: ChannelID, userId: UserID): Promise<boolean> {
		const member = await fetchOne<ThreadMemberRow>(
			FETCH_THREAD_MEMBER.bind({thread_id: threadId, user_id: userId}),
		);
		return member != null;
	}

	async getMember(threadId: ChannelID, userId: UserID): Promise<ThreadMemberRow | null> {
		return fetchOne<ThreadMemberRow>(
			FETCH_THREAD_MEMBER.bind({thread_id: threadId, user_id: userId}),
		);
	}

	async getUserThreads(userId: UserID): Promise<Array<ThreadMemberByUserRow>> {
		return fetchMany<ThreadMemberByUserRow>(
			FETCH_USER_THREADS.bind({user_id: userId}),
		);
	}

	async getMemberCount(threadId: ChannelID): Promise<number> {
		const members = await this.listMembers(threadId);
		return members.length;
	}
}
