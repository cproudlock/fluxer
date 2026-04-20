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

import styles from '@app/components/layout/UpdateBanner.module.css';
import {Platform} from '@app/lib/Platform';
import UpdaterStore from '@app/stores/UpdaterStore';
import {Trans} from '@lingui/react/macro';
import {ArrowClockwiseIcon, DownloadSimpleIcon, XIcon} from '@phosphor-icons/react';
import {observer} from 'mobx-react-lite';
import {useCallback, useMemo, useState} from 'react';

const DISMISSED_KEY = 'echowire:update-banner-dismissed-version';

function readDismissedVersion(): string | null {
	try {
		return window.localStorage.getItem(DISMISSED_KEY);
	} catch {
		return null;
	}
}

function writeDismissedVersion(version: string | null): void {
	try {
		if (version === null) {
			window.localStorage.removeItem(DISMISSED_KEY);
		} else {
			window.localStorage.setItem(DISMISSED_KEY, version);
		}
	} catch {
		// localStorage unavailable (private mode, etc.) — best effort
	}
}

export const UpdateBanner = observer(() => {
	const store = UpdaterStore;
	const [dismissedVersion, setDismissedVersion] = useState<string | null>(readDismissedVersion);

	const hasActionableNativeUpdate = Platform.isElectron && store.nativeUpdateReady;
	const hasActionableWebUpdate = !!store.updateInfo.web.available && !hasActionableNativeUpdate;
	const shouldShow = hasActionableNativeUpdate || hasActionableWebUpdate;

	// Track version so a dismissal only applies to the currently-known version —
	// a newer version arriving re-shows the banner.
	const currentVersion = store.displayVersion ?? '';
	const isDismissed = dismissedVersion !== null && dismissedVersion === currentVersion;

	const label = useMemo(() => {
		if (hasActionableNativeUpdate) {
			return currentVersion
				? `A new version of Echowire is ready — ${currentVersion}`
				: 'A new version of Echowire is ready';
		}
		return currentVersion
			? `A newer version is available — ${currentVersion}`
			: 'A newer version is available';
	}, [hasActionableNativeUpdate, currentVersion]);

	const handleApply = useCallback(() => {
		void store.applyUpdate();
	}, [store]);

	const handleDismiss = useCallback(() => {
		writeDismissedVersion(currentVersion);
		setDismissedVersion(currentVersion);
	}, [currentVersion]);

	if (!shouldShow || isDismissed) {
		return null;
	}

	return (
		<div className={styles.container} role="status" aria-live="polite">
			<div className={styles.left}>
				<DownloadSimpleIcon weight="bold" className={styles.icon} />
				<span className={styles.label}>{label}</span>
			</div>
			<div className={styles.right}>
				<button type="button" className={styles.applyButton} onClick={handleApply}>
					<ArrowClockwiseIcon weight="bold" className={styles.applyIcon} />
					{hasActionableNativeUpdate ? <Trans>Restart to update</Trans> : <Trans>Reload to update</Trans>}
				</button>
				<button type="button" className={styles.dismissButton} onClick={handleDismiss} aria-label="Dismiss">
					<XIcon weight="bold" />
				</button>
			</div>
		</div>
	);
});
