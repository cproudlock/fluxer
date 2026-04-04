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

import ThreadStore from '@app/stores/ThreadStore';
import type {GatewayHandlerContext} from '@app/stores/gateway/handlers';

interface ThreadMembersUpdatePayload {
	id: string;
	guild_id: string;
	member_count: number;
	added_members?: Array<{user_id: string; join_timestamp: string; flags: number}>;
	removed_member_ids?: Array<string>;
}

export function handleThreadMembersUpdate(data: ThreadMembersUpdatePayload, _context: GatewayHandlerContext): void {
	if (data.added_members) {
		for (const member of data.added_members) {
			ThreadStore.handleThreadMemberAdd(data.id, {
				id: data.id,
				userId: member.user_id,
				joinTimestamp: member.join_timestamp,
				flags: member.flags,
			});
		}
	}

	if (data.removed_member_ids) {
		for (const userId of data.removed_member_ids) {
			ThreadStore.handleThreadMemberRemove(data.id, userId);
		}
	}
}
