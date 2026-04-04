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

import {Config} from '@fluxer/api/src/Config';
import type {HonoEnv} from '@fluxer/api/src/types/HonoEnv';
import {createCaptchaProvider} from '@fluxer/captcha/src/CaptchaProviderFactory';
import type {ICaptchaProvider} from '@fluxer/captcha/src/ICaptchaProvider';
import {CaptchaRequiredError, InvalidCaptchaError} from '@fluxer/errors/src/CaptchaErrors';
import {extractClientIp} from '@fluxer/ip_utils/src/ClientIp';
import {createMiddleware} from 'hono/factory';
import {createHmac, randomBytes} from 'node:crypto';

let providers: Map<string, ICaptchaProvider> | null = null;
let defaultProvider: ICaptchaProvider | null = null;

function initializeProviders(): void {
	if (providers) return;
	providers = new Map();

	if (Config.dev.testModeEnabled) {
		const testProvider = createCaptchaProvider({mode: 'test'});
		defaultProvider = testProvider;
		return;
	}

	if (Config.captcha.hcaptcha?.secretKey) {
		const provider = createCaptchaProvider({mode: 'hcaptcha', secretKey: Config.captcha.hcaptcha.secretKey});
		providers.set('hcaptcha', provider);
	}

	if (Config.captcha.turnstile?.secretKey) {
		const provider = createCaptchaProvider({mode: 'turnstile', secretKey: Config.captcha.turnstile.secretKey});
		providers.set('turnstile', provider);
	}

	if (providers.size === 0) {
		throw new Error(
			'CAPTCHA_ENABLED=true but no captcha service has been configured. ' +
				'Please supply HCAPTCHA_SECRET_KEY or TURNSTILE_SECRET_KEY (or disable captcha).',
		);
	}

	defaultProvider = providers.get(Config.captcha.provider) ?? providers.values().next().value ?? null;
}

function resolveProvider(requestedType: string | undefined): ICaptchaProvider {
	if (defaultProvider && !providers?.size) {
		return defaultProvider;
	}

	if (requestedType && providers?.has(requestedType)) {
		return providers.get(requestedType)!;
	}

	if (defaultProvider) {
		return defaultProvider;
	}

	throw new Error('No captcha provider available');
}

// Native app bypass: challenge-response with HMAC
// Nonces are single-use and expire after 60 seconds
const NONCE_TTL_MS = 60_000;
const MAX_NONCE_CACHE = 10_000;
const pendingNonces = new Map<string, number>();

function cleanExpiredNonces() {
	const now = Date.now();
	for (const [nonce, created] of pendingNonces) {
		if (now - created > NONCE_TTL_MS) {
			pendingNonces.delete(nonce);
		}
	}
}

export function issueNativeBypassNonce(): string {
	if (pendingNonces.size > MAX_NONCE_CACHE) {
		cleanExpiredNonces();
	}
	const nonce = randomBytes(32).toString('hex');
	pendingNonces.set(nonce, Date.now());
	return nonce;
}

function verifyNativeBypass(token: string): boolean {
	const secret = Config.captcha.nativeBypassSecret;
	if (!secret || secret.length < 32) return false;

	const parts = token.split(':');
	if (parts.length !== 2) return false;

	const [nonce, signature] = parts;
	if (!nonce || !signature) return false;

	// Check nonce exists and hasn't expired
	const created = pendingNonces.get(nonce);
	if (created == null) return false;

	if (Date.now() - created > NONCE_TTL_MS) {
		pendingNonces.delete(nonce);
		return false;
	}

	// Consume nonce (single-use)
	pendingNonces.delete(nonce);

	// Verify HMAC
	const expected = createHmac('sha256', secret).update(nonce).digest('hex');
	if (expected.length !== signature.length) return false;

	// Constant-time comparison
	let mismatch = 0;
	for (let i = 0; i < expected.length; i++) {
		mismatch |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
	}
	return mismatch === 0;
}

export const CaptchaMiddleware = createMiddleware<HonoEnv>(async (ctx, next) => {
	if (!Config.captcha.enabled) {
		await next();
		return;
	}

	const captchaType = ctx.req.header('x-captcha-type');
	const token = ctx.req.header('x-captcha-token');

	// Native app bypass via HMAC challenge-response
	if (captchaType === 'native-bypass') {
		if (!token || !verifyNativeBypass(token)) {
			throw new InvalidCaptchaError();
		}
		await next();
		return;
	}

	initializeProviders();

	if (!token) {
		throw new CaptchaRequiredError();
	}

	const provider = resolveProvider(captchaType);

	const isValid = await provider.verify({
		token,
		remoteIp:
			extractClientIp(ctx.req.raw, {
				trustCfConnectingIp: Config.proxy.trust_cf_connecting_ip,
			}) ?? undefined,
	});

	if (!isValid) {
		throw new InvalidCaptchaError();
	}

	await next();
});
