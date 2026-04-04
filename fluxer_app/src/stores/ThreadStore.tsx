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

import UserStore from '@app/stores/UserStore';
import {makeAutoObservable} from 'mobx';

export interface ThreadMember {
	id: string;
	userId: string;
	joinTimestamp: string;
	flags: number;
}

class ThreadStore {
	activeThreadPanel: string | null = null;
	threadMembers = new Map<string, Array<ThreadMember>>();

	constructor() {
		makeAutoObservable<ThreadStore, never>(this, {}, {autoBind: true});
	}

	get isThreadPanelOpen(): boolean {
		return this.activeThreadPanel != null;
	}

	openThreadPanel(threadId: string) {
		this.activeThreadPanel = threadId;
	}

	closeThreadPanel() {
		this.activeThreadPanel = null;
	}

	handleThreadMembersUpdate(threadId: string, members: Array<ThreadMember>) {
		this.threadMembers.set(threadId, members);
	}

	handleThreadMemberAdd(threadId: string, member: ThreadMember) {
		const existing = this.threadMembers.get(threadId) ?? [];
		if (!existing.some((m) => m.userId === member.userId)) {
			this.threadMembers.set(threadId, [...existing, member]);
		}
	}

	handleThreadMemberRemove(threadId: string, userId: string) {
		const existing = this.threadMembers.get(threadId);
		if (existing) {
			this.threadMembers.set(
				threadId,
				existing.filter((m) => m.userId !== userId),
			);
		}
	}

	getThreadMembers(threadId: string): Array<ThreadMember> {
		return this.threadMembers.get(threadId) ?? [];
	}

	isCurrentUserMember(threadId: string): boolean {
		const currentUser = UserStore.getCurrentUser();
		if (!currentUser) return false;
		const members = this.threadMembers.get(threadId);
		if (!members) return false;
		return members.some((m) => m.userId === currentUser.id);
	}

	handleThreadDelete(threadId: string) {
		this.threadMembers.delete(threadId);
		if (this.activeThreadPanel === threadId) {
			this.activeThreadPanel = null;
		}
	}

	reset() {
		this.activeThreadPanel = null;
		this.threadMembers.clear();
	}
}

export default new ThreadStore();
