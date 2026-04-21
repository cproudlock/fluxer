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

/** @jsxRuntime automatic */
/** @jsxImportSource hono/jsx */

import type {MarketingContext} from '@fluxer/marketing/src/MarketingContext';
import {renderContentLayout} from '@fluxer/marketing/src/pages/Layout';
import {pageMeta} from '@fluxer/marketing/src/pages/layout/Meta';
import type {Context} from 'hono';

export async function renderDownloadPage(c: Context, ctx: MarketingContext): Promise<Response> {
	const meta = pageMeta('Download Echowire', 'Get the Echowire app for desktop, mobile, or the web.', 'website');
	const content: ReadonlyArray<JSX.Element> = [renderDownloadContent()];
	const html = renderContentLayout(c, ctx, meta, content);
	return c.html(html);
}

function renderDownloadContent(): JSX.Element {
	return (
		<section class="mx-auto max-w-3xl">
			<header class="mb-10 text-center">
				<h1 class="mb-4 font-bold text-4xl text-white">Download Echowire</h1>
				<p class="text-lg text-[#94A3B8]">
					Get the app for system-wide push-to-talk, notifications, and more.
				</p>
			</header>

			<h2 class="mb-4 font-semibold text-xs text-[#94A3B8] uppercase tracking-widest">Desktop</h2>
			<div class="mb-10 grid gap-4 md:grid-cols-2">
				{renderCard(
					'Windows',
					'Windows 10 or later, 64-bit',
					WINDOWS_ICON,
					<div class="dropdown relative" id="windows-dropdown">
						<button
							class="inline-flex items-center gap-2 rounded-lg bg-[#3B82F6] px-5 py-2.5 font-semibold text-sm text-white transition hover:bg-[#2563EB]"
							onclick="document.getElementById('windows-dropdown').classList.toggle('open')"
						>
							Download
							<svg viewBox="0 0 10 6" class="h-2.5 w-2.5 fill-none stroke-current stroke-[1.5]">
								<path d="M1 1l4 4 4-4" stroke-linecap="round" stroke-linejoin="round" />
							</svg>
						</button>
						<div class="dropdown-menu absolute right-0 top-full z-10 mt-1.5 hidden min-w-[220px] rounded-lg border border-[#1E293B] bg-[#101931] py-1 shadow-xl">
							<a href="/api/dl/desktop/stable/win32/x64/latest/setup" class="block px-4 py-2.5 transition hover:bg-[#1A2440]">
								<div class="font-semibold text-sm text-white">Installer (.exe)</div>
								<div class="text-xs text-[#94A3B8]">Standard setup, runs on Windows 10+</div>
							</a>
							<a
								href="#"
								onclick="navigator.clipboard.writeText('winget install Echowire.Echowire');this.querySelector('.dd-desc').textContent='Copied to clipboard';return false;"
								class="block px-4 py-2.5 transition hover:bg-[#1A2440]"
							>
								<div class="font-semibold text-sm text-white">winget</div>
								<div class="dd-desc text-xs text-[#94A3B8]">winget install Echowire.Echowire</div>
							</a>
						</div>
					</div>,
				)}
				{renderCard(
					'Linux',
					'x86_64 and ARM64, multiple formats',
					LINUX_ICON,
					<div class="dropdown relative" id="linux-dropdown">
						<button
							class="inline-flex items-center gap-2 rounded-lg bg-[#3B82F6] px-5 py-2.5 font-semibold text-sm text-white transition hover:bg-[#2563EB]"
							onclick="document.getElementById('linux-dropdown').classList.toggle('open')"
						>
							Download
							<svg viewBox="0 0 10 6" class="h-2.5 w-2.5 fill-none stroke-current stroke-[1.5]">
								<path d="M1 1l4 4 4-4" stroke-linecap="round" stroke-linejoin="round" />
							</svg>
						</button>
						<div class="dropdown-menu absolute right-0 top-full z-10 mt-1.5 hidden min-w-[260px] rounded-lg border border-[#1E293B] bg-[#101931] py-1 shadow-xl">
							<div class="px-4 py-1.5 font-semibold text-[10px] text-[#64748B] uppercase tracking-widest">x86_64</div>
							<a href="/api/dl/desktop/stable/linux/x64/latest/deb" class="block px-4 py-2.5 transition hover:bg-[#1A2440]">
								<div class="font-semibold text-sm text-white">.deb</div>
								<div class="text-xs text-[#94A3B8]">Ubuntu, Debian, and derivatives</div>
							</a>
							<a href="/api/dl/desktop/stable/linux/x64/latest/appimage" class="block px-4 py-2.5 transition hover:bg-[#1A2440]">
								<div class="font-semibold text-sm text-white">.AppImage</div>
								<div class="text-xs text-[#94A3B8]">Portable, runs on most distros</div>
							</a>
							<a href="/api/dl/desktop/stable/linux/x64/latest/rpm" class="block px-4 py-2.5 transition hover:bg-[#1A2440]">
								<div class="font-semibold text-sm text-white">.rpm</div>
								<div class="text-xs text-[#94A3B8]">Fedora, RHEL, openSUSE</div>
							</a>
							<a href="/api/dl/desktop/stable/linux/x64/latest/tar_gz" class="block px-4 py-2.5 transition hover:bg-[#1A2440]">
								<div class="font-semibold text-sm text-white">.tar.gz</div>
								<div class="text-xs text-[#94A3B8]">Generic Linux archive</div>
							</a>
							<div class="mt-1 border-t border-[#1E293B] px-4 pt-2 pb-1.5 font-semibold text-[10px] text-[#64748B] uppercase tracking-widest">ARM64</div>
							<a href="/api/dl/desktop/stable/linux/arm64/latest/deb" class="block px-4 py-2.5 transition hover:bg-[#1A2440]">
								<div class="font-semibold text-sm text-white">.deb (arm64)</div>
								<div class="text-xs text-[#94A3B8]">Raspberry Pi OS, Ubuntu ARM</div>
							</a>
							<a href="/api/dl/desktop/stable/linux/arm64/latest/appimage" class="block px-4 py-2.5 transition hover:bg-[#1A2440]">
								<div class="font-semibold text-sm text-white">.AppImage (arm64)</div>
								<div class="text-xs text-[#94A3B8]">Portable ARM64 build</div>
							</a>
							<a href="/api/dl/desktop/stable/linux/arm64/latest/rpm" class="block px-4 py-2.5 transition hover:bg-[#1A2440]">
								<div class="font-semibold text-sm text-white">.rpm (arm64)</div>
								<div class="text-xs text-[#94A3B8]">Fedora ARM, openSUSE ARM</div>
							</a>
							<a href="/api/dl/desktop/stable/linux/arm64/latest/tar_gz" class="block px-4 py-2.5 transition hover:bg-[#1A2440]">
								<div class="font-semibold text-sm text-white">.tar.gz (arm64)</div>
								<div class="text-xs text-[#94A3B8]">Generic ARM64 archive</div>
							</a>
						</div>
					</div>,
				)}
			</div>

			<h2 class="mb-4 font-semibold text-xs text-[#94A3B8] uppercase tracking-widest">Mobile</h2>
			<div class="mb-10 grid gap-4 md:grid-cols-2">
				{renderCard(
					'Android',
					'Android 7.0 or later',
					ANDROID_ICON,
					<a
						href="https://play.google.com/apps/testing/org.echowire.twa"
						class="inline-flex rounded-lg bg-[#3B82F6] px-5 py-2.5 font-semibold text-sm text-white transition hover:bg-[#2563EB]"
					>
						Google Play Beta
					</a>,
				)}
				{renderCard(
					'iOS',
					'iPhone and iPad, iOS 15 or later',
					IOS_ICON,
					<a
						href="https://testflight.apple.com/join/uBgF2xtT"
						class="inline-flex rounded-lg bg-[#3B82F6] px-5 py-2.5 font-semibold text-sm text-white transition hover:bg-[#2563EB]"
					>
						TestFlight Beta
					</a>,
				)}
			</div>

			{renderVerifySection()}

			{renderDropdownScript()}
		</section>
	);
}

function renderVerifySection(): JSX.Element {
	return (
		<details class="mt-10 rounded-xl border border-[#1E293B] bg-[#101931] p-6">
			<summary class="cursor-pointer select-none font-semibold text-white">
				Verify your download
			</summary>
			<div class="mt-4 space-y-4 text-sm text-[#94A3B8]">
				<p>
					Every build is cryptographically signed. Windows and macOS are verified automatically by the OS.
					On Linux you can check the signature yourself to be sure nothing was tampered with.
				</p>
				<div>
					<div class="font-semibold text-white">Windows</div>
					<p>
						The installer is signed via Azure Trusted Signing (Authenticode). SmartScreen refuses to run
						tampered builds. No user action required.
					</p>
				</div>
				<div>
					<div class="font-semibold text-white">macOS</div>
					<p>
						Signed with our Apple Developer ID and notarized by Apple. Gatekeeper rejects tampered builds
						on first launch. No user action required.
					</p>
				</div>
				<div>
					<div class="font-semibold text-white">Linux</div>
					<p>
						Every <code class="text-white">.AppImage</code>, <code class="text-white">.deb</code>,{' '}
						<code class="text-white">.rpm</code>, and <code class="text-white">.tar.gz</code> ships with a
						detached GPG signature (<code class="text-white">.asc</code>) next to the download, plus a
						signed <code class="text-white">SHA256SUMS.txt</code>. Verify with:
					</p>
					<pre class="mt-3 overflow-x-auto rounded-lg bg-[#0A1428] p-4 text-xs text-[#CBD5E1]">
						{`curl -O https://echowire.org/.well-known/echowire-signing-key.asc
gpg --import echowire-signing-key.asc
# Expected fingerprint:
#   CFE4 1D9A 40A9 7F70 1334  1135 2025 06F9 D549 F87E

gpg --verify Echowire-1.6.1.AppImage.asc Echowire-1.6.1.AppImage`}
					</pre>
					<p class="mt-3">
						Look for <code class="text-white">Good signature from "Echowire Releases"</code>. The printed
						fingerprint must match the one above exactly.
					</p>
				</div>
			</div>
		</details>
	);
}

function renderCard(title: string, desc: string, icon: string, action: JSX.Element): JSX.Element {
	return (
		<div class="flex flex-col items-start gap-4 rounded-xl border border-[#1E293B] bg-[#101931] p-6">
			<div class="flex items-center gap-3">
				<svg class="h-8 w-8 fill-[#94A3B8]" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
					<path d={icon} />
				</svg>
				<div>
					<div class="font-semibold text-white">{title}</div>
					<div class="text-xs text-[#94A3B8]">{desc}</div>
				</div>
			</div>
			{action}
		</div>
	);
}

function renderDropdownScript(): JSX.Element {
	return (
		<script
			dangerouslySetInnerHTML={{
				__html: `document.addEventListener('click',function(e){
['windows-dropdown','linux-dropdown'].forEach(function(id){
var dd=document.getElementById(id);
if(dd&&!dd.contains(e.target))dd.classList.remove('open');
});
});`,
			}}
		/>
	);
}

const WINDOWS_ICON =
	'M0,0H11.377V11.372H0ZM12.623,0H24V11.372H12.623ZM0,12.623H11.377V24H0Zm12.623,0H24V24H12.623';

const LINUX_ICON =
	'M12.504 0c-.155 0-.315.008-.48.021-4.226.333-3.105 4.807-3.17 6.298-.076 1.092-.3 1.953-1.05 3.02-.885 1.051-2.127 2.75-2.716 4.521-.278.832-.41 1.684-.287 2.489a.424.424 0 00-.11.135c-.26.268-.45.6-.663.839-.199.199-.485.267-.797.4-.313.136-.658.269-.864.68-.09.189-.136.394-.132.602 0 .199.027.4.055.536.058.399.116.728.04.97-.249.68-.28 1.145-.106 1.484.174.334.535.47.94.601.81.2 1.91.135 2.774.6.926.466 1.866.67 2.616.47.526-.116.97-.464 1.208-.946.587-.003 1.23-.269 2.26-.334.699-.058 1.574.267 2.577.2.025.134.063.198.114.333l.003.003c.391.778 1.113 1.132 1.884 1.071.771-.06 1.592-.536 2.257-1.306.631-.765 1.683-1.084 2.378-1.503.348-.199.629-.469.649-.853.023-.4-.2-.811-.714-1.376v-.097l-.003-.003c-.17-.2-.25-.535-.338-.926-.085-.401-.182-.786-.492-1.046h-.003c-.059-.054-.123-.067-.188-.135a.357.357 0 00-.19-.064c.431-1.278.264-2.55-.173-3.694-.533-1.41-1.465-2.638-2.175-3.483-.796-1.005-1.576-1.957-1.56-3.368.026-2.152.236-6.133-3.544-6.139z';

const ANDROID_ICON =
	'M18.4395 5.5586c-.675 1.1664-1.352 2.3318-2.0274 3.498-.0366-.0155-.0742-.0286-.1113-.043-1.8249-.6957-3.484-.8-4.42-.787-1.8551.0185-3.3544.4643-4.2597.8203-.084-.1494-1.7526-3.021-2.0215-3.4864a1.1451 1.1451 0 00-.1406-.1914c-.3312-.364-.9054-.4859-1.379-.203-.475.282-.7136.9361-.3886 1.5019 1.9466 3.3696-.0966-.2158 1.9473 3.3593.0172.031-.4946.2642-1.3926 1.0177C2.8987 12.176.452 14.772 0 18.9902h24c-.119-1.1108-.3686-2.099-.7461-3.0683-.7438-1.9118-1.8435-3.2928-2.7402-4.1836a12.1048 12.1048 0 00-2.1309-1.6875c.6594-1.122 1.312-2.2559 1.9649-3.3848.2077-.3615.1886-.7956-.0079-1.1191a1.1001 1.1001 0 00-.8515-.5332c-.5225-.0536-.9392.3128-1.0488.5449zm-.0391 8.461c.3944.5926.324 1.3306-.1563 1.6503-.4799.3197-1.188.0985-1.582-.4941-.3944-.5927-.324-1.3307.1563-1.6504.4727-.315 1.1812-.1086 1.582.4941zM7.207 13.5273c.4803.3197.5506 1.0577.1563 1.6504-.394.5926-1.1038.8138-1.584.4941-.48-.3197-.5503-1.0577-.1563-1.6504.4008-.6021 1.1087-.8106 1.584-.4941z';

const IOS_ICON =
	'M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z';
