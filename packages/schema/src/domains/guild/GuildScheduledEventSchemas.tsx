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

import {
	MAX_EVENT_DESCRIPTION_LENGTH,
	MAX_EVENT_LOCATION_LENGTH,
	MAX_EVENT_NAME_LENGTH,
} from '@fluxer/constants/src/ScheduledEventConstants';
import {createStringType, SnowflakeStringType, SnowflakeType} from '@fluxer/schema/src/primitives/SchemaPrimitives';
import {z} from 'zod';

export const GuildScheduledEventResponse = z.object({
	id: SnowflakeStringType.describe('The unique identifier for this event'),
	guild_id: SnowflakeStringType.describe('The guild this event belongs to'),
	name: z.string().describe('The name of the event'),
	description: z.string().nullable().describe('The description of the event'),
	scheduled_start_time: z.string().describe('ISO 8601 timestamp for when the event starts'),
	scheduled_end_time: z.string().nullable().describe('ISO 8601 timestamp for when the event ends'),
	entity_type: z.number().describe('The type of event (1 = voice, 2 = external)'),
	status: z.number().describe('The status of the event (1 = scheduled, 2 = active, 3 = completed, 4 = cancelled)'),
	channel_id: SnowflakeStringType.nullable().describe('The voice channel ID for voice events'),
	location: z.string().nullable().describe('The location for external events'),
	cover_image: z.string().nullable().describe('The cover image hash'),
	creator_id: SnowflakeStringType.describe('The ID of the user who created the event'),
	user_count: z.number().describe('The number of users interested in the event'),
	created_at: z.string().describe('ISO 8601 timestamp for when the event was created'),
});

export type GuildScheduledEventResponse = z.infer<typeof GuildScheduledEventResponse>;

export const GuildScheduledEventListResponse = z.array(GuildScheduledEventResponse).max(100);
export type GuildScheduledEventListResponse = z.infer<typeof GuildScheduledEventListResponse>;

export const GuildScheduledEventCreateRequest = z.object({
	name: createStringType(1, MAX_EVENT_NAME_LENGTH).describe('The name of the event'),
	description: createStringType(0, MAX_EVENT_DESCRIPTION_LENGTH).nullish().describe('The description of the event'),
	scheduled_start_time: z.string().describe('ISO 8601 timestamp for when the event starts'),
	scheduled_end_time: z.string().nullish().describe('ISO 8601 timestamp for when the event ends'),
	entity_type: z.union([z.literal(1), z.literal(2)]).describe('The type of event (1 = voice, 2 = external)'),
	channel_id: SnowflakeType.nullish().describe('The voice channel ID (required for voice events)'),
	location: createStringType(1, MAX_EVENT_LOCATION_LENGTH).nullish().describe('The location (required for external events)'),
	cover_image: z.string().nullish().describe('Base64-encoded cover image data URI, or null to remove'),
});

export type GuildScheduledEventCreateRequest = z.infer<typeof GuildScheduledEventCreateRequest>;

export const GuildScheduledEventUpdateRequest = z.object({
	name: createStringType(1, MAX_EVENT_NAME_LENGTH).optional().describe('The name of the event'),
	description: createStringType(0, MAX_EVENT_DESCRIPTION_LENGTH).nullish().describe('The description of the event'),
	scheduled_start_time: z.string().optional().describe('ISO 8601 timestamp for when the event starts'),
	scheduled_end_time: z.string().nullish().describe('ISO 8601 timestamp for when the event ends'),
	entity_type: z.union([z.literal(1), z.literal(2)]).optional().describe('The type of event'),
	channel_id: SnowflakeType.nullish().describe('The voice channel ID'),
	location: createStringType(1, MAX_EVENT_LOCATION_LENGTH).nullish().describe('The location'),
	status: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).optional().describe('The status of the event'),
	cover_image: z.string().nullish().describe('Base64-encoded cover image data URI, or null to remove'),
});

export type GuildScheduledEventUpdateRequest = z.infer<typeof GuildScheduledEventUpdateRequest>;

export const GuildScheduledEventUserResponse = z.object({
	user_id: SnowflakeStringType.describe('The user ID'),
	event_id: SnowflakeStringType.describe('The event ID'),
	guild_id: SnowflakeStringType.describe('The guild ID'),
});

export type GuildScheduledEventUserResponse = z.infer<typeof GuildScheduledEventUserResponse>;
