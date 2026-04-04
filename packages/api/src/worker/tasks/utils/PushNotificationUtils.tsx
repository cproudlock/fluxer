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

import type {UserID} from '@fluxer/api/src/BrandedTypes';
import type {FCMService} from '@fluxer/api/src/infrastructure/FCMService';
import {Logger} from '@fluxer/api/src/Logger';
import type {PushDevice} from '@fluxer/api/src/models/PushDevice';
import type {PushDeviceRepository} from '@fluxer/api/src/user/repositories/PushDeviceRepository';
import type {User} from '@fluxer/api/src/models/User';
import type {IKVProvider} from '@fluxer/kv_client/src/IKVProvider';

const USER_MENTION_PATTERN = /<@(\d+)>/g;
const PUSH_THROTTLE_MAX = 3;
const PUSH_THROTTLE_TTL_SECONDS = 3600; // 1 hour

export async function sanitizeMentionContent(
	content: string,
	mentionedUserIds: Set<UserID>,
	userRepository: {listUsers(userIds: Array<UserID>): Promise<Array<User>>},
): Promise<string> {
	if (!content.includes('<@')) return content;

	const userIds = Array.from(mentionedUserIds);
	if (userIds.length === 0) {
		return content.replace(USER_MENTION_PATTERN, '@unknown');
	}

	const users = await userRepository.listUsers(userIds);
	const userMap = new Map<string, string>();
	for (const user of users) {
		userMap.set(user.id.toString(), user.globalName ?? user.username);
	}

	return content.replace(USER_MENTION_PATTERN, (_match, id: string) => {
		const name = userMap.get(id);
		return name ? `@${name}` : '@unknown';
	});
}

export async function shouldThrottlePush(
	kvClient: IKVProvider,
	userId: string,
	channelId: string,
): Promise<boolean> {
	const key = `push:throttle:${userId}:${channelId}`;
	try {
		const count = await kvClient.incr(key);
		if (count === 1) {
			await kvClient.expire(key, PUSH_THROTTLE_TTL_SECONDS);
		}
		return count > PUSH_THROTTLE_MAX;
	} catch {
		return false;
	}
}

export async function resetPushThrottle(
	kvClient: IKVProvider,
	userId: string,
	channelId: string,
): Promise<void> {
	const key = `push:throttle:${userId}:${channelId}`;
	try {
		await kvClient.del(key);
	} catch {
		// best effort
	}
}

export async function sendPlatformAwarePush(
	fcmService: FCMService,
	devices: Array<PushDevice>,
	params: {title: string; body: string; data: Record<string, string>},
	pushDeviceRepository?: PushDeviceRepository,
): Promise<void> {
	const androidDevices: Array<PushDevice> = [];
	const iosDevices: Array<PushDevice> = [];

	for (const device of devices) {
		if (device.platform === 'android') {
			androidDevices.push(device);
		} else {
			iosDevices.push(device);
		}
	}

	const allResults: Array<{token: string; result: 'ok' | 'unregistered' | 'error'}> = [];
	const collapseKey = params.data.channel_id ? `ch_${params.data.channel_id}` : undefined;

	// Android: data-only so onMessageReceived fires (enables inline reply)
	if (androidDevices.length > 0) {
		const results = await fcmService.sendToTokens(androidDevices.map((d) => d.fcmToken), {
			data: {
				...params.data,
				title: params.title,
				body: params.body,
			},
			android: {
				priority: 'high',
			},
		});
		allResults.push(...results);
	}

	// iOS: notification payload required for visible display + category for reply action
	if (iosDevices.length > 0) {
		const results = await fcmService.sendToTokens(iosDevices.map((d) => d.fcmToken), {
			data: params.data,
			apns: {
				headers: {
					'apns-push-type': 'alert',
					'apns-priority': '10',
				},
				payload: {
					aps: {
						alert: {title: params.title, body: params.body},
						sound: 'default',
						category: 'MESSAGE',
						'mutable-content': 1,
						...(collapseKey ? {'thread-id': collapseKey} : {}),
					},
				},
			},
		});
		allResults.push(...results);
	}

	// Clean up stale tokens
	if (pushDeviceRepository) {
		const tokenToDevice = new Map<string, PushDevice>();
		for (const device of devices) {
			tokenToDevice.set(device.fcmToken, device);
		}

		const staleTokens = allResults.filter((r) => r.result === 'unregistered');
		for (const {token} of staleTokens) {
			const device = tokenToDevice.get(token);
			if (device) {
				Logger.info({userId: device.userId, deviceId: device.deviceId, fcmToken: token.substring(0, 16)}, 'Removing unregistered FCM token');
				await pushDeviceRepository.deletePushDevice(device.userId, device.deviceId).catch((err) => {
					Logger.error({error: err}, 'Failed to delete stale push device');
				});
			}
		}
	}
}
