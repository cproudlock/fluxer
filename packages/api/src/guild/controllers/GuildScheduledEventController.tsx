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

import {createChannelID, createGuildID, createScheduledEventID} from '@fluxer/api/src/BrandedTypes';
import {LoginRequired} from '@fluxer/api/src/middleware/AuthMiddleware';
import {RateLimitMiddleware} from '@fluxer/api/src/middleware/RateLimitMiddleware';
import {OpenAPI} from '@fluxer/api/src/middleware/ResponseTypeMiddleware';
import {RateLimitConfigs} from '@fluxer/api/src/RateLimitConfig';
import type {HonoApp} from '@fluxer/api/src/types/HonoEnv';
import {Validator} from '@fluxer/api/src/Validator';
import {GuildIdEventIdParam, GuildIdParam} from '@fluxer/schema/src/domains/common/CommonParamSchemas';
import {
	GuildScheduledEventCreateRequest,
	GuildScheduledEventListResponse,
	GuildScheduledEventResponse,
	GuildScheduledEventUpdateRequest,
} from '@fluxer/schema/src/domains/guild/GuildScheduledEventSchemas';
import {z} from 'zod';

export function GuildScheduledEventController(app: HonoApp) {
	// List events
	app.get(
		'/guilds/:guild_id/scheduled-events',
		RateLimitMiddleware(RateLimitConfigs.GUILD_SCHEDULED_EVENT_LIST),
		LoginRequired,
		Validator('param', GuildIdParam),
		OpenAPI({
			operationId: 'list_guild_scheduled_events',
			summary: 'List guild scheduled events',
			description: 'Returns all scheduled events for a guild.',
			responseSchema: GuildScheduledEventListResponse,
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: 'Guild Scheduled Events',
		}),
		async (ctx) => {
			const user = ctx.get('user');
			const guildId = createGuildID(ctx.req.valid('param').guild_id);
			const events = await ctx.get('scheduledEventService').listEvents({userId: user.id, guildId});
			return ctx.json(events);
		},
	);

	// Create event
	app.post(
		'/guilds/:guild_id/scheduled-events',
		RateLimitMiddleware(RateLimitConfigs.GUILD_SCHEDULED_EVENT_CREATE),
		LoginRequired,
		Validator('param', GuildIdParam),
		Validator('json', GuildScheduledEventCreateRequest),
		OpenAPI({
			operationId: 'create_guild_scheduled_event',
			summary: 'Create a scheduled event',
			description: 'Creates a new scheduled event. Requires MANAGE_EVENTS permission.',
			responseSchema: GuildScheduledEventResponse,
			statusCode: 201,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: 'Guild Scheduled Events',
		}),
		async (ctx) => {
			const user = ctx.get('user');
			const guildId = createGuildID(ctx.req.valid('param').guild_id);
			const body = ctx.req.valid('json');
			const event = await ctx.get('scheduledEventService').createEvent({
				userId: user.id,
				guildId,
				name: body.name,
				description: body.description,
				scheduledStartTime: body.scheduled_start_time,
				scheduledEndTime: body.scheduled_end_time,
				entityType: body.entity_type,
				channelId: body.channel_id ? createChannelID(body.channel_id) : null,
				location: body.location,
			});
			return ctx.json(event, 201);
		},
	);

	// Get event
	app.get(
		'/guilds/:guild_id/scheduled-events/:event_id',
		RateLimitMiddleware(RateLimitConfigs.GUILD_SCHEDULED_EVENT_LIST),
		LoginRequired,
		Validator('param', GuildIdEventIdParam),
		OpenAPI({
			operationId: 'get_guild_scheduled_event',
			summary: 'Get a scheduled event',
			description: 'Returns a single scheduled event.',
			responseSchema: GuildScheduledEventResponse,
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: 'Guild Scheduled Events',
		}),
		async (ctx) => {
			const user = ctx.get('user');
			const params = ctx.req.valid('param');
			const guildId = createGuildID(params.guild_id);
			const events = await ctx.get('scheduledEventService').listEvents({userId: user.id, guildId});
			const event = events.find((e) => e.id === String(params.event_id));
			if (!event) return ctx.json({message: 'Unknown Event'}, 404);
			return ctx.json(event);
		},
	);

	// Update event
	app.patch(
		'/guilds/:guild_id/scheduled-events/:event_id',
		RateLimitMiddleware(RateLimitConfigs.GUILD_SCHEDULED_EVENT_UPDATE),
		LoginRequired,
		Validator('param', GuildIdEventIdParam),
		Validator('json', GuildScheduledEventUpdateRequest),
		OpenAPI({
			operationId: 'update_guild_scheduled_event',
			summary: 'Update a scheduled event',
			description: 'Updates a scheduled event. Requires MANAGE_EVENTS permission.',
			responseSchema: GuildScheduledEventResponse,
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: 'Guild Scheduled Events',
		}),
		async (ctx) => {
			const user = ctx.get('user');
			const params = ctx.req.valid('param');
			const guildId = createGuildID(params.guild_id);
			const eventId = createScheduledEventID(params.event_id);
			const body = ctx.req.valid('json');
			const event = await ctx.get('scheduledEventService').updateEvent({
				userId: user.id,
				guildId,
				eventId,
				name: body.name,
				description: body.description,
				scheduledStartTime: body.scheduled_start_time,
				scheduledEndTime: body.scheduled_end_time,
				entityType: body.entity_type,
				channelId: body.channel_id ? createChannelID(body.channel_id) : body.channel_id === null ? null : undefined,
				location: body.location,
				status: body.status,
			});
			return ctx.json(event);
		},
	);

	// Delete event
	app.delete(
		'/guilds/:guild_id/scheduled-events/:event_id',
		RateLimitMiddleware(RateLimitConfigs.GUILD_SCHEDULED_EVENT_DELETE),
		LoginRequired,
		Validator('param', GuildIdEventIdParam),
		OpenAPI({
			operationId: 'delete_guild_scheduled_event',
			summary: 'Delete a scheduled event',
			description: 'Deletes a scheduled event. Requires MANAGE_EVENTS permission.',
			responseSchema: null,
			statusCode: 204,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: 'Guild Scheduled Events',
		}),
		async (ctx) => {
			const user = ctx.get('user');
			const params = ctx.req.valid('param');
			const guildId = createGuildID(params.guild_id);
			const eventId = createScheduledEventID(params.event_id);
			await ctx.get('scheduledEventService').deleteEvent({userId: user.id, guildId, eventId});
			return ctx.body(null, 204);
		},
	);

	// List interested users
	app.get(
		'/guilds/:guild_id/scheduled-events/:event_id/users',
		RateLimitMiddleware(RateLimitConfigs.GUILD_SCHEDULED_EVENT_LIST),
		LoginRequired,
		Validator('param', GuildIdEventIdParam),
		OpenAPI({
			operationId: 'list_guild_scheduled_event_users',
			summary: 'List interested users',
			description: 'Returns users interested in a scheduled event.',
			responseSchema: z.array(z.object({user_id: z.string(), event_id: z.string(), guild_id: z.string()})),
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: 'Guild Scheduled Events',
		}),
		async (ctx) => {
			const user = ctx.get('user');
			const params = ctx.req.valid('param');
			const guildId = createGuildID(params.guild_id);
			const eventId = createScheduledEventID(params.event_id);
			const users = await ctx.get('scheduledEventService').listInterestedUsers({userId: user.id, guildId, eventId});
			return ctx.json(users);
		},
	);

	// Mark interested
	app.put(
		'/guilds/:guild_id/scheduled-events/:event_id/users/@me',
		RateLimitMiddleware(RateLimitConfigs.GUILD_SCHEDULED_EVENT_RSVP),
		LoginRequired,
		Validator('param', GuildIdEventIdParam),
		OpenAPI({
			operationId: 'add_guild_scheduled_event_user',
			summary: 'Mark interested',
			description: 'Marks the current user as interested in an event.',
			responseSchema: null,
			statusCode: 204,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: 'Guild Scheduled Events',
		}),
		async (ctx) => {
			const user = ctx.get('user');
			const params = ctx.req.valid('param');
			const guildId = createGuildID(params.guild_id);
			const eventId = createScheduledEventID(params.event_id);
			await ctx.get('scheduledEventService').addInterested({userId: user.id, guildId, eventId});
			return ctx.body(null, 204);
		},
	);

	// Remove interest
	app.delete(
		'/guilds/:guild_id/scheduled-events/:event_id/users/@me',
		RateLimitMiddleware(RateLimitConfigs.GUILD_SCHEDULED_EVENT_RSVP),
		LoginRequired,
		Validator('param', GuildIdEventIdParam),
		OpenAPI({
			operationId: 'remove_guild_scheduled_event_user',
			summary: 'Remove interest',
			description: 'Removes the current user from the interested list.',
			responseSchema: null,
			statusCode: 204,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: 'Guild Scheduled Events',
		}),
		async (ctx) => {
			const user = ctx.get('user');
			const params = ctx.req.valid('param');
			const guildId = createGuildID(params.guild_id);
			const eventId = createScheduledEventID(params.event_id);
			await ctx.get('scheduledEventService').removeInterested({userId: user.id, guildId, eventId});
			return ctx.body(null, 204);
		},
	);
}
