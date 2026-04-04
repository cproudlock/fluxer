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

import {createChannelID, createGuildID, createUserID} from '@fluxer/api/src/BrandedTypes';
import {LoginRequired} from '@fluxer/api/src/middleware/AuthMiddleware';
import {RateLimitMiddleware} from '@fluxer/api/src/middleware/RateLimitMiddleware';
import {OpenAPI} from '@fluxer/api/src/middleware/ResponseTypeMiddleware';
import {RateLimitConfigs} from '@fluxer/api/src/RateLimitConfig';
import type {HonoApp} from '@fluxer/api/src/types/HonoEnv';
import {Validator} from '@fluxer/api/src/Validator';
import {ChannelResponse} from '@fluxer/schema/src/domains/channel/ChannelSchemas';
import {ChannelIdParam, ChannelIdUserIdParam, GuildIdParam} from '@fluxer/schema/src/domains/common/CommonParamSchemas';
import {CreateThreadRequest, UpdateThreadRequest} from '@fluxer/schema/src/domains/channel/ThreadSchemas';
import {z} from 'zod';

export function ThreadController(app: HonoApp) {
	// Create thread from a channel
	app.post(
		'/channels/:channel_id/threads',
		RateLimitMiddleware(RateLimitConfigs.THREAD_CREATE),
		LoginRequired,
		Validator('param', ChannelIdParam),
		Validator('json', CreateThreadRequest),
		OpenAPI({
			operationId: 'create_thread',
			summary: 'Create a thread',
			description: 'Creates a new thread in the specified channel.',
			responseSchema: ChannelResponse,
			statusCode: 201,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: 'Threads',
		}),
		async (ctx) => {
			const userId = ctx.get('user').id;
			const channelId = createChannelID(ctx.req.valid('param').channel_id);
			const body = ctx.req.valid('json');
			const requestCache = ctx.get('requestCache');
			const threadService = ctx.get('threadService');

			const response = await threadService.createThread({
				userId,
				channelId,
				name: body.name,
				autoArchiveDuration: body.auto_archive_duration,
				type: body.type,
				appliedTags: body.applied_tags,
				requestCache,
			});

			return ctx.json(response, 201);
		},
	);

	// Update thread
	app.patch(
		'/channels/:channel_id/thread',
		RateLimitMiddleware(RateLimitConfigs.THREAD_UPDATE),
		LoginRequired,
		Validator('param', ChannelIdParam),
		Validator('json', UpdateThreadRequest),
		OpenAPI({
			operationId: 'update_thread',
			summary: 'Update a thread',
			description: 'Modifies settings of a thread.',
			responseSchema: ChannelResponse,
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: 'Threads',
		}),
		async (ctx) => {
			const userId = ctx.get('user').id;
			const threadId = createChannelID(ctx.req.valid('param').channel_id);
			const body = ctx.req.valid('json');
			const requestCache = ctx.get('requestCache');
			const threadService = ctx.get('threadService');

			const response = await threadService.updateThread({
				userId,
				threadId,
				name: body.name,
				archived: body.archived,
				autoArchiveDuration: body.auto_archive_duration,
				locked: body.locked,
				invitable: body.invitable,
				rateLimitPerUser: body.rate_limit_per_user,
				appliedTags: body.applied_tags,
				requestCache,
			});

			return ctx.json(response);
		},
	);

	// Delete thread
	app.delete(
		'/channels/:channel_id/thread',
		RateLimitMiddleware(RateLimitConfigs.THREAD_DELETE),
		LoginRequired,
		Validator('param', ChannelIdParam),
		OpenAPI({
			operationId: 'delete_thread',
			summary: 'Delete a thread',
			description: 'Permanently deletes a thread.',
			responseSchema: null,
			statusCode: 204,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: 'Threads',
		}),
		async (ctx) => {
			const userId = ctx.get('user').id;
			const threadId = createChannelID(ctx.req.valid('param').channel_id);
			const threadService = ctx.get('threadService');

			await threadService.deleteThread({userId, threadId});
			return ctx.body(null, 204);
		},
	);

	// Join thread (self)
	app.put(
		'/channels/:channel_id/thread-members/@me',
		RateLimitMiddleware(RateLimitConfigs.THREAD_MEMBERS),
		LoginRequired,
		Validator('param', ChannelIdParam),
		OpenAPI({
			operationId: 'join_thread',
			summary: 'Join a thread',
			description: 'Adds the current user to a thread.',
			responseSchema: null,
			statusCode: 204,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: 'Threads',
		}),
		async (ctx) => {
			const userId = ctx.get('user').id;
			const threadId = createChannelID(ctx.req.valid('param').channel_id);
			const threadService = ctx.get('threadService');

			await threadService.joinThread({userId, threadId});
			return ctx.body(null, 204);
		},
	);

	// Leave thread (self)
	app.delete(
		'/channels/:channel_id/thread-members/@me',
		RateLimitMiddleware(RateLimitConfigs.THREAD_MEMBERS),
		LoginRequired,
		Validator('param', ChannelIdParam),
		OpenAPI({
			operationId: 'leave_thread',
			summary: 'Leave a thread',
			description: 'Removes the current user from a thread.',
			responseSchema: null,
			statusCode: 204,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: 'Threads',
		}),
		async (ctx) => {
			const userId = ctx.get('user').id;
			const threadId = createChannelID(ctx.req.valid('param').channel_id);
			const threadService = ctx.get('threadService');

			await threadService.leaveThread({userId, threadId});
			return ctx.body(null, 204);
		},
	);

	// Add member to thread
	app.put(
		'/channels/:channel_id/thread-members/:user_id',
		RateLimitMiddleware(RateLimitConfigs.THREAD_MEMBERS),
		LoginRequired,
		Validator('param', ChannelIdUserIdParam),
		OpenAPI({
			operationId: 'add_thread_member',
			summary: 'Add a member to a thread',
			description: 'Adds another user to a thread.',
			responseSchema: null,
			statusCode: 204,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: 'Threads',
		}),
		async (ctx) => {
			const userId = ctx.get('user').id;
			const params = ctx.req.valid('param');
			const threadId = createChannelID(params.channel_id);
			const targetUserId = createUserID(params.user_id);
			const threadService = ctx.get('threadService');

			await threadService.addMember({userId, threadId, targetUserId});
			return ctx.body(null, 204);
		},
	);

	// Remove member from thread
	app.delete(
		'/channels/:channel_id/thread-members/:user_id',
		RateLimitMiddleware(RateLimitConfigs.THREAD_MEMBERS),
		LoginRequired,
		Validator('param', ChannelIdUserIdParam),
		OpenAPI({
			operationId: 'remove_thread_member',
			summary: 'Remove a member from a thread',
			description: 'Removes a user from a thread.',
			responseSchema: null,
			statusCode: 204,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: 'Threads',
		}),
		async (ctx) => {
			const userId = ctx.get('user').id;
			const params = ctx.req.valid('param');
			const threadId = createChannelID(params.channel_id);
			const targetUserId = createUserID(params.user_id);
			const threadService = ctx.get('threadService');

			await threadService.removeMember({userId, threadId, targetUserId});
			return ctx.body(null, 204);
		},
	);

	// List thread members
	app.get(
		'/channels/:channel_id/thread-members',
		RateLimitMiddleware(RateLimitConfigs.THREAD_MEMBERS),
		LoginRequired,
		Validator('param', ChannelIdParam),
		OpenAPI({
			operationId: 'list_thread_members',
			summary: 'List thread members',
			description: 'Returns all members of a thread.',
			responseSchema: z.array(z.object({
				id: z.string(),
				user_id: z.string(),
				join_timestamp: z.string(),
				flags: z.number(),
			})),
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: 'Threads',
		}),
		async (ctx) => {
			const userId = ctx.get('user').id;
			const threadId = createChannelID(ctx.req.valid('param').channel_id);
			const threadService = ctx.get('threadService');

			return ctx.json(await threadService.listMembers({userId, threadId}));
		},
	);

	// List active threads in guild
	app.get(
		'/guilds/:guild_id/threads/active',
		RateLimitMiddleware(RateLimitConfigs.THREAD_LIST),
		LoginRequired,
		Validator('param', GuildIdParam),
		OpenAPI({
			operationId: 'list_active_threads',
			summary: 'List active threads',
			description: 'Returns all active threads in a guild.',
			responseSchema: z.object({threads: z.array(ChannelResponse)}),
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: 'Threads',
		}),
		async (ctx) => {
			const userId = ctx.get('user').id;
			const guildId = createGuildID(ctx.req.valid('param').guild_id);
			const requestCache = ctx.get('requestCache');
			const threadService = ctx.get('threadService');

			return ctx.json(await threadService.listActiveThreads({userId, guildId, requestCache}));
		},
	);

	// List archived public threads
	app.get(
		'/channels/:channel_id/threads/archived/public',
		RateLimitMiddleware(RateLimitConfigs.THREAD_LIST),
		LoginRequired,
		Validator('param', ChannelIdParam),
		OpenAPI({
			operationId: 'list_archived_public_threads',
			summary: 'List archived public threads',
			description: 'Returns all archived public threads in a channel.',
			responseSchema: z.object({threads: z.array(ChannelResponse), has_more: z.boolean()}),
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: 'Threads',
		}),
		async (ctx) => {
			const userId = ctx.get('user').id;
			const channelId = createChannelID(ctx.req.valid('param').channel_id);
			const requestCache = ctx.get('requestCache');
			const threadService = ctx.get('threadService');

			return ctx.json(await threadService.listArchivedThreads({userId, channelId, requestCache}));
		},
	);
}
