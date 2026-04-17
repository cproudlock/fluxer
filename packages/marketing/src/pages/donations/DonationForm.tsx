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
import {escapeInlineScriptValue} from '@fluxer/marketing/src/pages/InlineScriptEscaping';

export interface DonationI18n {
	email: string;
	emailPlaceholder: string;
	amount: string;
	amountOther: string;
	amountPlaceholder: string;
	donationType: string;
	oneTime: string;
	monthly: string;
	yearly: string;
	orLabel: string;
	currency: string;
	donate: string;
	processing: string;
	errorInvalidEmail: string;
	errorInvalidAmount: string;
	errorGeneric: string;
	errorNetwork: string;
}

export function getDonationI18n(ctx: MarketingContext): DonationI18n {
	return {
		email: ctx.i18n.getMessage('donations.form.email', ctx.locale),
		emailPlaceholder: ctx.i18n.getMessage('donations.form.email_placeholder', ctx.locale),
		amount: ctx.i18n.getMessage('donations.form.amount', ctx.locale),
		amountOther: ctx.i18n.getMessage('donations.form.amount_other', ctx.locale),
		amountPlaceholder: ctx.i18n.getMessage('donations.form.amount_placeholder', ctx.locale),
		donationType: ctx.i18n.getMessage('donations.form.donation_type', ctx.locale),
		oneTime: ctx.i18n.getMessage('donations.form.one_time', ctx.locale),
		monthly: ctx.i18n.getMessage('donations.form.monthly', ctx.locale),
		yearly: ctx.i18n.getMessage('donations.form.yearly', ctx.locale),
		orLabel: ctx.i18n.getMessage('donations.form.or_label', ctx.locale),
		currency: ctx.i18n.getMessage('donations.form.currency', ctx.locale),
		donate: ctx.i18n.getMessage('donations.donate.action', ctx.locale),
		processing: ctx.i18n.getMessage('donations.form.processing', ctx.locale),
		errorInvalidEmail: ctx.i18n.getMessage('donations.errors.invalid_email', ctx.locale),
		errorInvalidAmount: ctx.i18n.getMessage('donations.errors.invalid_amount', ctx.locale),
		errorGeneric: ctx.i18n.getMessage('donations.errors.generic', ctx.locale),
		errorNetwork: ctx.i18n.getMessage('donations.errors.network', ctx.locale),
	};
}

export function renderDonationForm(
	ctx: MarketingContext,
	type: 'individual' | 'business',
	isHidden: boolean,
): JSX.Element {
	const i18n = getDonationI18n(ctx);

	return (
		<div id={`donate-content-${type}`} class={isHidden ? 'donate-content hidden w-full' : 'donate-content w-full'}>
			<div class="mx-auto max-w-lg space-y-6">
				<div>
					<label for={`donation-email-${type}`} class="mb-2 block font-medium text-white text-sm">
						{i18n.email}
					</label>
					<input
						type="email"
						id={`donation-email-${type}`}
						placeholder={i18n.emailPlaceholder}
						class="w-full rounded-lg border border-[#1E293B] px-4 py-3 text-white focus:border-[#3B82F6] focus:outline-none"
					/>
				</div>

				<div>
					<span class="mb-2 block font-medium text-white text-sm">{i18n.amount}</span>
					<div class="grid grid-cols-3 gap-2 sm:grid-cols-6">
						{[5, 25, 50, 100, 500].map((amount) => (
							<button
								type="button"
								id={`amount-btn-${type}-${amount}`}
								onclick={`selectDonationAmount('${type}', ${amount})`}
								class={
									amount === 25
										? 'donation-amount-btn rounded-lg border border-[#3B82F6] px-4 py-2 font-medium text-[#3B82F6] transition hover:border-[#3B82F6] hover:text-[#3B82F6]'
										: 'donation-amount-btn rounded-lg border border-[#1E293B] px-4 py-2 font-medium text-[#E2E8F0] transition hover:border-[#3B82F6] hover:text-[#3B82F6]'
								}
							>
								${amount}
							</button>
						))}
						<button
							type="button"
							id={`amount-btn-${type}-custom`}
							onclick={`showCustomDonationAmount('${type}')`}
							class="donation-amount-btn rounded-lg border border-[#1E293B] px-4 py-2 font-medium text-[#E2E8F0] transition hover:border-[#3B82F6] hover:text-[#3B82F6]"
						>
							{i18n.amountOther}
						</button>
					</div>
					<input
						type="number"
						id={`custom-amount-${type}`}
						min="5"
						max="1000"
						placeholder={i18n.amountPlaceholder}
						class="mt-2 hidden w-full rounded-lg border border-[#1E293B] px-4 py-3"
					/>
				</div>

				<div>
					<span class="mb-2 block font-medium text-white text-sm">{i18n.donationType}</span>
					<div class="flex gap-2">
						<button
							type="button"
							id={`donation-type-${type}-once`}
							onclick={`selectDonationType('${type}', 'once')`}
							class="donation-type-btn flex-1 rounded-lg border-2 border-[#3B82F6] bg-[#3B82F6] px-4 py-2 font-medium text-white"
						>
							{i18n.oneTime}
						</button>
						<button
							type="button"
							id={`donation-type-${type}-month`}
							onclick={`selectDonationType('${type}', 'month')`}
							class="donation-type-btn flex-1 rounded-lg border-2 border-[#1E293B] px-4 py-2 font-medium text-[#E2E8F0]"
						>
							{i18n.monthly}
						</button>
						<button
							type="button"
							id={`donation-type-${type}-year`}
							onclick={`selectDonationType('${type}', 'year')`}
							class="donation-type-btn flex-1 rounded-lg border-2 border-[#1E293B] px-4 py-2 font-medium text-[#E2E8F0]"
						>
							{i18n.yearly}
						</button>
					</div>
				</div>

				<div>
					<span class="mb-2 block font-medium text-white text-sm">{i18n.currency}</span>
					<div class="flex gap-2">
						<button
							type="button"
							id={`currency-${type}-usd`}
							onclick={`selectDonationCurrency('${type}', 'usd')`}
							class="donation-currency-btn flex-1 rounded-lg border-2 border-[#3B82F6] bg-[#3B82F6] px-4 py-2 font-medium text-white"
						>
							$ USD
						</button>
						<button
							type="button"
							id={`currency-${type}-eur`}
							onclick={`selectDonationCurrency('${type}', 'eur')`}
							class="donation-currency-btn flex-1 rounded-lg border-2 border-[#1E293B] px-4 py-2 font-medium text-[#E2E8F0]"
						>
							€ EUR
						</button>
					</div>
				</div>

				<button
					type="button"
					id={`donate-btn-${type}`}
					onclick={`submitDonation('${type}')`}
					class="w-full rounded-xl bg-[#3B82F6] py-3 font-semibold text-white transition-colors hover:bg-[#2563EB]"
				>
					{i18n.donate}
				</button>

				<p id={`donation-error-${type}`} class="hidden text-center text-[#F43F5E] text-sm" />
			</div>
		</div>
	);
}

export function renderDonationScript(ctx: MarketingContext): JSX.Element {
	const apiEndpoint = ctx.apiEndpoint;
	const i18n = getDonationI18n(ctx);

	return (
		<script
			dangerouslySetInnerHTML={{
				__html: `var donationState = {
  individual: {amount: 25, donationType: 'once', currency: 'usd', customAmount: false},
  business: {amount: 25, donationType: 'once', currency: 'usd', customAmount: false}
};

function selectDonationAmount(type, amount) {
  donationState[type].amount = amount;
  donationState[type].customAmount = false;
  var customInput = document.getElementById('custom-amount-' + type);
  customInput.classList.add('hidden');
  var buttons = document.querySelectorAll('[id^="amount-btn-' + type + '-"]');
  buttons.forEach(function(btn) {
    btn.classList.remove('border-[#3B82F6]', 'text-[#3B82F6]');
    btn.classList.add('border-[#1E293B]', 'text-[#E2E8F0]');
  });
  var selected = document.getElementById('amount-btn-' + type + '-' + amount);
  if (selected) {
    selected.classList.add('border-[#3B82F6]', 'text-[#3B82F6]');
    selected.classList.remove('border-[#1E293B]', 'text-[#E2E8F0]');
  }
}

function showCustomDonationAmount(type) {
  donationState[type].customAmount = true;
  var customInput = document.getElementById('custom-amount-' + type);
  customInput.classList.remove('hidden');
  var buttons = document.querySelectorAll('[id^="amount-btn-' + type + '-"]');
  buttons.forEach(function(btn) {
    btn.classList.remove('border-[#3B82F6]', 'text-[#3B82F6]');
    btn.classList.add('border-[#1E293B]', 'text-[#E2E8F0]');
  });
  var customBtn = document.getElementById('amount-btn-' + type + '-custom');
  customBtn.classList.add('border-[#3B82F6]', 'text-[#3B82F6]');
  customBtn.classList.remove('border-[#1E293B]', 'text-[#E2E8F0]');
}

function selectDonationType(type, donationType) {
  donationState[type].donationType = donationType;
  var buttons = document.querySelectorAll('[id^="donation-type-' + type + '-"]');
  buttons.forEach(function(btn) {
    btn.classList.remove('border-[#3B82F6]', 'bg-[#3B82F6]', 'text-white');
    btn.classList.add('border-[#1E293B]', 'text-[#E2E8F0]');
  });
  var selected = document.getElementById('donation-type-' + type + '-' + donationType);
  selected.classList.add('border-[#3B82F6]', 'bg-[#3B82F6]', 'text-white');
  selected.classList.remove('border-[#1E293B]', 'text-[#E2E8F0]');
}

function selectDonationCurrency(type, currency) {
  donationState[type].currency = currency;
  var buttons = document.querySelectorAll('[id^="currency-' + type + '-"]');
  buttons.forEach(function(btn) {
    btn.classList.remove('border-[#3B82F6]', 'bg-[#3B82F6]', 'text-white');
    btn.classList.add('border-[#1E293B]', 'text-[#E2E8F0]');
  });
  var selected = document.getElementById('currency-' + type + '-' + currency);
  selected.classList.add('border-[#3B82F6]', 'bg-[#3B82F6]', 'text-white');
  selected.classList.remove('border-[#1E293B]', 'text-[#E2E8F0]');
}

async function submitDonation(type) {
  var email = document.getElementById('donation-email-' + type).value;
  var errorEl = document.getElementById('donation-error-' + type);
  errorEl.classList.add('hidden');

  if (!email || !email.includes('@')) {
    errorEl.textContent = '${escapeInlineScriptValue(i18n.errorInvalidEmail)}';
    errorEl.classList.remove('hidden');
    return;
  }

  var amount = donationState[type].customAmount
    ? parseInt(document.getElementById('custom-amount-' + type).value, 10)
    : donationState[type].amount;

  if (!amount || amount < 5 || amount > 1000) {
    errorEl.textContent = '${escapeInlineScriptValue(i18n.errorInvalidAmount)}';
    errorEl.classList.remove('hidden');
    return;
  }

  var btn = document.getElementById('donate-btn-' + type);
  btn.disabled = true;
  btn.textContent = '${escapeInlineScriptValue(i18n.processing)}';

  try {
    var interval = donationState[type].donationType === 'once' ? null : donationState[type].donationType;
    var response = await fetch('${apiEndpoint}/donations/checkout', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        email: email,
        amount_cents: amount * 100,
        currency: donationState[type].currency,
        interval: interval
      })
    });

    if (response.ok) {
      var data = await response.json();
      window.location.href = data.url;
    } else {
      var error = await response.json();
      errorEl.textContent = error.message || '${escapeInlineScriptValue(i18n.errorGeneric)}';
      errorEl.classList.remove('hidden');
    }
  } catch (err) {
    errorEl.textContent = '${escapeInlineScriptValue(i18n.errorNetwork)}';
    errorEl.classList.remove('hidden');
  }

  btn.disabled = false;
  btn.textContent = '${escapeInlineScriptValue(i18n.donate)}';
}`,
			}}
		/>
	);
}

const DONATE_BTN_SECONDARY =
	'flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-[#1E293B] bg-[#101931] px-6 font-semibold text-white transition-colors hover:bg-[#1A2440]';
