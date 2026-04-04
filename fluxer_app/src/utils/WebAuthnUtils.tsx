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

import {Platform} from '@app/lib/Platform';
import {getElectronAPI} from '@app/utils/NativeUtils';
import {
	type AuthenticationResponseJSON,
	browserSupportsWebAuthn,
	type PublicKeyCredentialCreationOptionsJSON,
	type PublicKeyCredentialRequestOptionsJSON,
	type RegistrationResponseJSON,
	startAuthentication,
	startRegistration,
} from '@simplewebauthn/browser';

interface NativePasskeyBridge {
	passkeyIsSupported(): Promise<boolean>;
	passkeyRegister(optionsJSON: string): Promise<string>;
	passkeyAuthenticate(optionsJSON: string): Promise<string>;
}

function getNativePasskeyBridge(): NativePasskeyBridge | null {
	const bridge = (window as unknown as Record<string, unknown>).EchowireNativePasskey as NativePasskeyBridge | undefined;
	if (bridge && typeof bridge.passkeyIsSupported === 'function' && typeof bridge.passkeyRegister === 'function' && typeof bridge.passkeyAuthenticate === 'function') {
		return bridge;
	}
	return null;
}

function isIOSNativeApp(): boolean {
	if (typeof navigator === 'undefined') return false;
	const ua = navigator.userAgent;
	return /EchowireApp/.test(ua) && /iPhone|iPad|iPod/.test(ua);
}

export async function assertWebAuthnSupported(): Promise<void> {
	if (Platform.isElectron) {
		const electronApi = getElectronAPI();
		const nativeSupported = electronApi && (await electronApi.passkeyIsSupported?.());
		if (nativeSupported) {
			return;
		}
		if (browserSupportsWebAuthn()) {
			return;
		}
		throw new Error('WebAuthn is not supported in this environment.');
	}

	if (isIOSNativeApp()) {
		const bridge = getNativePasskeyBridge();
		if (bridge) {
			const supported = await bridge.passkeyIsSupported();
			if (supported) {
				return;
			}
		}
		throw new Error('Passkeys require iOS 16+.');
	}

	if (!browserSupportsWebAuthn()) {
		throw new Error('WebAuthn is not supported in this environment.');
	}
}

export async function performRegistration(
	options: PublicKeyCredentialCreationOptionsJSON,
): Promise<RegistrationResponseJSON> {
	await assertWebAuthnSupported();

	if (Platform.isElectron) {
		const electronApi = getElectronAPI();
		const nativeSupported = electronApi && (await electronApi.passkeyIsSupported?.());
		if (nativeSupported && electronApi.passkeyRegister) {
			return electronApi.passkeyRegister(options);
		}
	}

	if (isIOSNativeApp()) {
		const bridge = getNativePasskeyBridge();
		if (bridge) {
			const resultJSON = await bridge.passkeyRegister(JSON.stringify(options));
			return JSON.parse(resultJSON) as RegistrationResponseJSON;
		}
	}

	return await startRegistration({optionsJSON: options});
}

export async function performAuthentication(
	options: PublicKeyCredentialRequestOptionsJSON,
): Promise<AuthenticationResponseJSON> {
	await assertWebAuthnSupported();

	if (Platform.isElectron) {
		const electronApi = getElectronAPI();
		const nativeSupported = electronApi && (await electronApi.passkeyIsSupported?.());
		if (nativeSupported && electronApi.passkeyAuthenticate) {
			return electronApi.passkeyAuthenticate(options);
		}
	}

	if (isIOSNativeApp()) {
		const bridge = getNativePasskeyBridge();
		if (bridge) {
			const resultJSON = await bridge.passkeyAuthenticate(JSON.stringify(options));
			return JSON.parse(resultJSON) as AuthenticationResponseJSON;
		}
	}

	return await startAuthentication({optionsJSON: options});
}
