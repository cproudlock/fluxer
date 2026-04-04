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

import * as ModalActionCreators from '@app/actions/ModalActionCreators';
import {modal} from '@app/actions/ModalActionCreators';
import {CaptchaModal, type CaptchaType} from '@app/components/modals/CaptchaModal';
import HttpClient, {type HttpResponse} from '@app/lib/HttpClient';
import {getResponseCode, getResponseMessage} from '@app/utils/ApiErrorUtils';
import type {I18n} from '@lingui/core';
import {msg} from '@lingui/core/macro';
import {action, makeObservable, observable} from 'mobx';
import {observer} from 'mobx-react-lite';

export interface CaptchaResult {
	token: string;
	type: CaptchaType;
}

class CaptchaState {
	error: string | null = null;
	isVerifying = false;

	constructor() {
		makeObservable(this, {
			error: observable,
			isVerifying: observable,
			setError: action,
			setIsVerifying: action,
			reset: action,
		});
	}

	setError(error: string | null) {
		this.error = error;
	}

	setIsVerifying(isVerifying: boolean) {
		this.isVerifying = isVerifying;
	}

	reset() {
		this.error = null;
		this.isVerifying = false;
	}
}

interface NativeBypassBridge {
	computeCaptchaBypass(nonce: string): Promise<string> | string;
}

declare global {
	interface Window {
		EchowireNativeCaptcha?: NativeBypassBridge;
	}
}

function hasNativeBypassBridge(): boolean {
	return typeof window.EchowireNativeCaptcha?.computeCaptchaBypass === 'function';
}

async function getNativeBypassToken(): Promise<CaptchaResult | null> {
	if (!hasNativeBypassBridge()) return null;

	try {
		const response = await fetch('/api/captcha/native-challenge');
		if (!response.ok) return null;

		const {nonce} = (await response.json()) as {nonce: string};
		if (!nonce) return null;

		const signature = await window.EchowireNativeCaptcha!.computeCaptchaBypass(nonce);
		if (!signature) return null;

		return {token: `${nonce}:${signature}`, type: 'native-bypass' as CaptchaType};
	} catch {
		return null;
	}
}

class CaptchaInterceptorStore {
	private state = new CaptchaState();
	private pendingPromise: {resolve: (result: CaptchaResult) => void; reject: (error: Error) => void} | null = null;
	private i18n: I18n | null = null;

	setI18n(i18n: I18n) {
		this.i18n = i18n;
	}

	constructor() {
		HttpClient.setInterceptors({
			interceptResponse: this.intercept.bind(this),
		});
	}

	private isCaptchaError(response: HttpResponse): boolean {
		const code = getResponseCode(response.body);
		return code === 'CAPTCHA_REQUIRED' || code === 'INVALID_CAPTCHA';
	}

	private showCaptchaModal(): Promise<CaptchaResult> {
		if (this.pendingPromise) {
			this.pendingPromise.reject(new Error('Captcha cancelled'));
			this.pendingPromise = null;
		}

		this.state.reset();

		return new Promise((resolve, reject) => {
			this.pendingPromise = {resolve, reject};

			const handleVerify = (token: string, captchaType: CaptchaType) => {
				const result = {token, type: captchaType};
				this.state.setIsVerifying(true);
				if (this.pendingPromise) {
					this.pendingPromise.resolve(result);
					this.pendingPromise = null;
				}
			};

			const handleCancel = () => {
				this.state.reset();
				if (this.pendingPromise) {
					this.pendingPromise.reject(new Error('Captcha cancelled'));
					this.pendingPromise = null;
				}
				ModalActionCreators.pop();
			};

			const CaptchaModalWrapper = observer(() => (
				<CaptchaModal
					onVerify={handleVerify}
					onCancel={handleCancel}
					error={this.state.error}
					isVerifying={this.state.isVerifying}
					closeOnVerify={false}
				/>
			));

			ModalActionCreators.push(modal(() => <CaptchaModalWrapper />));
		});
	}

	private intercept(
		response: HttpResponse,
		retryWithHeaders: (headers: Record<string, string>) => Promise<HttpResponse>,
		reject: (error: Error) => void,
	): boolean | Promise<HttpResponse> | undefined {
		if (response.status === 400 && this.isCaptchaError(response)) {
			// Try native app bypass first (no UI needed)
			if (hasNativeBypassBridge()) {
				const promise = getNativeBypassToken()
					.then((result) => {
						if (result) {
							return retryWithHeaders({
								'X-Captcha-Token': result.token,
								'X-Captcha-Type': result.type,
							});
						}
						// Native bypass failed, fall through to modal
						return this.showCaptchaModalAndRetry(retryWithHeaders, reject);
					})
					.catch(() => this.showCaptchaModalAndRetry(retryWithHeaders, reject));

				return promise;
			}

			return this.showCaptchaModalAndRetry(retryWithHeaders, reject);
		}

		return undefined;
	}

	private showCaptchaModalAndRetry(
		retryWithHeaders: (headers: Record<string, string>) => Promise<HttpResponse>,
		reject: (error: Error) => void,
	): Promise<HttpResponse> {
		const i18n = this.i18n!;
		const errorMessage = i18n._(msg`Captcha verification failed. Please try again.`);

		this.state.setError(errorMessage);
		this.state.setIsVerifying(false);

		return this.showCaptchaModal()
			.then((captchaResult) => {
				this.state.setError(null);
				this.state.setIsVerifying(false);
				ModalActionCreators.pop();
				return retryWithHeaders({
					'X-Captcha-Token': captchaResult.token,
					'X-Captcha-Type': captchaResult.type,
				});
			})
			.catch((error) => {
				this.state.reset();
				ModalActionCreators.pop();
				reject(error);
				throw error;
			});
	}
}

export default new CaptchaInterceptorStore();
