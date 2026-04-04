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

export const GuildScheduledEventEntityType = {
	VOICE: 1,
	EXTERNAL: 2,
} as const;

export const GuildScheduledEventStatus = {
	SCHEDULED: 1,
	ACTIVE: 2,
	COMPLETED: 3,
	CANCELLED: 4,
} as const;

export const MAX_EVENTS_PER_GUILD = 100;
export const MAX_EVENT_NAME_LENGTH = 100;
export const MAX_EVENT_DESCRIPTION_LENGTH = 1000;
export const MAX_EVENT_LOCATION_LENGTH = 100;
