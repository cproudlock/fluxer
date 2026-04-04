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

import {createStringType, Int32Type, SnowflakeType} from '@fluxer/schema/src/primitives/SchemaPrimitives';
import {z} from 'zod';

export const CreateThreadRequest = z.object({
	name: createStringType(1, 100).describe('The name of the thread (1-100 characters)'),
	auto_archive_duration: z
		.union([z.literal(0), z.literal(60), z.literal(1440), z.literal(4320), z.literal(10080)])
		.optional()
		.describe('Duration in minutes to auto-archive after inactivity (0 = never, 60, 1440, 4320, 10080)'),
	type: z
		.union([z.literal(11), z.literal(12)])
		.optional()
		.describe('The type of thread to create (11 = public, 12 = private)'),
	applied_tags: z.array(SnowflakeType).max(5).optional().describe('Tag IDs to apply to this forum post (max 5)'),
});
export type CreateThreadRequest = z.infer<typeof CreateThreadRequest>;

export const UpdateThreadRequest = z.object({
	name: createStringType(1, 100).optional().describe('The name of the thread (1-100 characters)'),
	archived: z.boolean().optional().describe('Whether the thread is archived'),
	auto_archive_duration: z
		.union([z.literal(0), z.literal(60), z.literal(1440), z.literal(4320), z.literal(10080)])
		.optional()
		.describe('Duration in minutes to auto-archive after inactivity (0 = never)'),
	locked: z.boolean().optional().describe('Whether the thread is locked'),
	invitable: z.boolean().optional().describe('Whether non-moderators can add users to a private thread'),
	rate_limit_per_user: Int32Type.optional().describe('Slowmode rate limit in seconds'),
	applied_tags: z.array(SnowflakeType).max(5).optional().describe('Tag IDs applied to this forum post (max 5)'),
});
export type UpdateThreadRequest = z.infer<typeof UpdateThreadRequest>;

export const ThreadMemberResponse = z.object({
	id: z.string().describe('The ID of the thread'),
	user_id: z.string().describe('The ID of the user'),
	join_timestamp: z.string().describe('ISO 8601 timestamp when the user joined the thread'),
	flags: z.number().describe('Thread member flags'),
});
export type ThreadMemberResponse = z.infer<typeof ThreadMemberResponse>;
