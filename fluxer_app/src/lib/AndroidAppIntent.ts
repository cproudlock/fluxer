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

const ANDROID_PACKAGE = 'org.echowire.twa';

declare global {
	interface Window {
		EchowireBridge?: unknown;
	}
}

function isInsideEchowireApp(): boolean {
	return typeof window !== 'undefined' && typeof window.EchowireBridge !== 'undefined';
}

function isAndroid(): boolean {
	if (typeof navigator === 'undefined') return false;
	return /Android/i.test(navigator.userAgent);
}

/**
 * If running on Android Chrome (Custom Tab or otherwise) *outside* the Echowire
 * app, attempt to bounce the current page into the app via an intent:// URI.
 * The token is carried as a string extra because intent:// syntax cannot carry a
 * URL fragment; `MainActivity.buildSafeUrl` rehydrates it into a `#token=...`
 * fragment before loading the WebView.
 *
 * Returns true if a redirect was attempted (caller should avoid racing a
 * POST against the backend for a few hundred ms). Returns false otherwise.
 */
export function tryRedirectEmailTokenIntoApp(path: '/authorize-ip' | '/verify', token: string): boolean {
	if (!token) return false;
	if (isInsideEchowireApp()) return false;
	if (!isAndroid()) return false;

	// Token in email is always alphanumeric — reject anything unusual before
	// injecting into an intent URI.
	if (!/^[A-Za-z0-9_-]+$/.test(token)) return false;

	const fallback = `https://echowire.org${path}#token=${encodeURIComponent(token)}`;
	const intentUrl =
		`intent://echowire.org${path}` +
		`#Intent` +
		`;scheme=https` +
		`;package=${ANDROID_PACKAGE}` +
		`;action=android.intent.action.VIEW` +
		`;S.token=${encodeURIComponent(token)}` +
		`;S.browser_fallback_url=${encodeURIComponent(fallback)}` +
		`;end`;

	try {
		window.location.href = intentUrl;
		return true;
	} catch {
		return false;
	}
}
