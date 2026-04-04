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

import {execFile} from 'node:child_process';
import * as fs from 'node:fs';
import * as https from 'node:https';
import * as path from 'node:path';
import {BUILD_CHANNEL} from '@electron/common/BuildChannel';
import {setQuitting} from '@electron/main/Window';
import {type BrowserWindow, app, ipcMain} from 'electron';
import log from 'electron-log';
import {autoUpdater} from 'electron-updater';

export type UpdaterContext = 'user' | 'background' | 'focus';
export type UpdaterEvent =
	| {type: 'checking'; context: UpdaterContext}
	| {type: 'available'; context: UpdaterContext; version?: string | null}
	| {type: 'not-available'; context: UpdaterContext}
	| {type: 'downloaded'; context: UpdaterContext; version?: string | null}
	| {type: 'error'; context: UpdaterContext; message: string};

let lastContext: UpdaterContext = 'background';

function send(win: BrowserWindow | null, event: UpdaterEvent) {
	win?.webContents.send('updater-event', event);
}

const isAppImage = Boolean(process.env.APPIMAGE);

type LinuxInstallType = 'appimage' | 'deb' | 'rpm' | 'extracted';

function detectLinuxInstallType(): LinuxInstallType {
	if (isAppImage) return 'appimage';
	const execPath = process.execPath;
	if (execPath.startsWith('/opt/') || execPath.startsWith('/usr/')) {
		if (fs.existsSync('/usr/bin/dpkg')) return 'deb';
		if (fs.existsSync('/usr/bin/rpm')) return 'rpm';
	}
	return 'extracted';
}

function fetchLatestVersion(): Promise<string | null> {
	const url = `https://echowire.org/dl/desktop/${BUILD_CHANNEL}/linux/x64/latest-linux.yml`;
	return new Promise((resolve) => {
		https
			.get(url, {timeout: 10_000}, (res) => {
				if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
					https
						.get(res.headers.location, {timeout: 10_000}, (redirectRes) => {
							let data = '';
							redirectRes.on('data', (chunk: Buffer) => {
								data += chunk.toString();
							});
							redirectRes.on('end', () => {
								const match = data.match(/^version:\s*(.+)$/m);
								resolve(match?.[1]?.trim() ?? null);
							});
						})
						.on('error', () => resolve(null));
					return;
				}
				let data = '';
				res.on('data', (chunk: Buffer) => {
					data += chunk.toString();
				});
				res.on('end', () => {
					const match = data.match(/^version:\s*(.+)$/m);
					resolve(match?.[1]?.trim() ?? null);
				});
			})
			.on('error', () => resolve(null));
	});
}

function getUpdateScriptPath(): string {
	return path.join(app.getPath('home'), 'Applications', 'echowire-update.sh');
}

function registerScriptUpdater(getMainWindow: () => BrowserWindow | null, installType: 'extracted' | 'deb' | 'rpm') {
	const currentVersion = app.getVersion();
	let latestVersion: string | null = null;

	async function checkForUpdates() {
		send(getMainWindow(), {type: 'checking', context: lastContext});

		try {
			latestVersion = await fetchLatestVersion();

			if (!latestVersion) {
				send(getMainWindow(), {type: 'error', context: lastContext, message: 'Failed to check for updates'});
				return;
			}

			if (latestVersion !== currentVersion) {
				log.info(`Update available: ${currentVersion} → ${latestVersion}`);
				send(getMainWindow(), {type: 'available', context: lastContext, version: latestVersion});
				send(getMainWindow(), {type: 'downloaded', context: lastContext, version: latestVersion});
			} else {
				log.info(`Up to date: ${currentVersion}`);
				send(getMainWindow(), {type: 'not-available', context: lastContext});
			}
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : String(err);
			log.error('Update check failed:', message);
			send(getMainWindow(), {type: 'error', context: lastContext, message});
		}
	}

	ipcMain.handle('updater-check', async (_e, context: UpdaterContext) => {
		lastContext = context;
		await checkForUpdates();
	});

	ipcMain.handle('updater-install', async () => {
		if (installType === 'extracted') {
			const scriptPath = getUpdateScriptPath();
			if (!fs.existsSync(scriptPath)) {
				log.error(`Update script not found: ${scriptPath}`);
				send(getMainWindow(), {type: 'error', context: lastContext, message: 'Update script not found'});
				return;
			}

			log.info('Running update script and restarting...');
			setQuitting(true);

			execFile('bash', [scriptPath], (error, stdout, stderr) => {
				if (error) {
					log.error('Update script failed:', error.message, stderr);
					return;
				}
				log.info('Update complete:', stdout.trim());
				app.relaunch();
				app.exit(0);
			});
		} else {
			if (!latestVersion) {
				send(getMainWindow(), {type: 'error', context: lastContext, message: 'No update available'});
				return;
			}

			const arch = installType === 'deb' ? 'amd64' : 'x86_64';
			const filename = `Echowire-${latestVersion}-${arch}.${installType}`;
			const dlUrl = `https://echowire.org/dl/desktop/${BUILD_CHANNEL}/linux/x64/${filename}`;
			const tmpPath = path.join(app.getPath('temp'), filename);

			log.info(`Downloading ${filename}...`);

			execFile('curl', ['-fL', '-o', tmpPath, dlUrl], {timeout: 300_000}, (dlError) => {
				if (dlError) {
					log.error('Download failed:', dlError.message);
					send(getMainWindow(), {type: 'error', context: lastContext, message: `Download failed: ${dlError.message}`});
					return;
				}

				log.info(`Installing ${filename} via pkexec...`);
				const cmd = installType === 'deb' ? 'dpkg' : 'rpm';
				const args = installType === 'deb' ? [cmd, '-i', tmpPath] : [cmd, '-U', tmpPath];

				execFile('pkexec', args, {timeout: 120_000}, (installError) => {
					try {
						fs.unlinkSync(tmpPath);
					} catch {}

					if (installError) {
						log.error('Install failed:', installError.message);
						send(getMainWindow(), {
							type: 'error',
							context: lastContext,
							message: `Install failed: ${installError.message}`,
						});
						return;
					}

					log.info(`Updated to ${latestVersion}`);
					setQuitting(true);
					app.relaunch();
					app.exit(0);
				});
			});
		}
	});

	setTimeout(() => {
		checkForUpdates().catch((err: unknown) => {
			log.warn('Background update check failed:', err);
		});
	}, 10_000);
}

function registerNativeUpdater(getMainWindow: () => BrowserWindow | null) {
	autoUpdater.logger = log;
	autoUpdater.autoDownload = true;
	autoUpdater.autoInstallOnAppQuit = true;

	autoUpdater.setFeedURL({
		provider: 'generic',
		url: `https://echowire.org/dl/desktop/${BUILD_CHANNEL}/${process.platform}/${process.arch}`,
	});

	autoUpdater.on('checking-for-update', () => {
		send(getMainWindow(), {type: 'checking', context: lastContext});
	});

	autoUpdater.on('update-available', (info) => {
		send(getMainWindow(), {type: 'available', context: lastContext, version: info.version ?? null});
	});

	autoUpdater.on('update-not-available', () => {
		send(getMainWindow(), {type: 'not-available', context: lastContext});
	});

	autoUpdater.on('update-downloaded', (info) => {
		send(getMainWindow(), {type: 'downloaded', context: lastContext, version: info.version ?? null});
	});

	autoUpdater.on('error', (err: Error) => {
		send(getMainWindow(), {type: 'error', context: lastContext, message: err?.message ?? String(err)});
	});

	ipcMain.handle('updater-check', async (_e, context: UpdaterContext) => {
		lastContext = context;
		await autoUpdater.checkForUpdates();
	});

	ipcMain.handle('updater-install', async () => {
		setQuitting(true);
		autoUpdater.quitAndInstall();
	});

	setTimeout(() => {
		autoUpdater.checkForUpdates().catch((err: unknown) => {
			log.warn('Background update check failed:', err);
		});
	}, 10_000);
}

export function registerUpdater(getMainWindow: () => BrowserWindow | null) {
	if (process.platform === 'win32') {
		log.info('Windows — using electron-updater (NSIS)');
		registerNativeUpdater(getMainWindow);
	} else if (process.platform === 'linux') {
		const installType = detectLinuxInstallType();
		switch (installType) {
			case 'appimage':
				log.info('AppImage — using electron-updater');
				registerNativeUpdater(getMainWindow);
				break;
			case 'deb':
				log.info('.deb install — using package updater (pkexec dpkg)');
				registerScriptUpdater(getMainWindow, 'deb');
				break;
			case 'rpm':
				log.info('.rpm install — using package updater (pkexec rpm)');
				registerScriptUpdater(getMainWindow, 'rpm');
				break;
			case 'extracted':
				log.info('Extracted install — using script updater');
				registerScriptUpdater(getMainWindow, 'extracted');
				break;
		}
	} else {
		log.info('Using electron-updater');
		registerNativeUpdater(getMainWindow);
	}
}
