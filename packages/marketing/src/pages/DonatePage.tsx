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
import {renderDonationForm, renderDonationScript} from '@fluxer/marketing/src/pages/donations/DonationForm';
import {renderDonationManageForm} from '@fluxer/marketing/src/pages/donations/DonationManageForm';
import {renderContentLayout} from '@fluxer/marketing/src/pages/Layout';
import {pageMeta} from '@fluxer/marketing/src/pages/layout/Meta';
import {href} from '@fluxer/marketing/src/UrlUtils';
import type {Context} from 'hono';

export async function renderDonatePage(c: Context, ctx: MarketingContext): Promise<Response> {
	const donationType = getDonationType(c);
	const content: ReadonlyArray<JSX.Element> = [renderDonateContent(ctx, donationType)];

	const meta = pageMeta(
		ctx.i18n.getMessage('donations.donate.label', ctx.locale),
		ctx.i18n.getMessage('donations.support_message', ctx.locale),
		'website',
	);
	const html = renderContentLayout(c, ctx, meta, content, {footerClassName: 'rounded-t-3xl'});
	return c.html(html);
}

function getDonationType(c: Context): 'individual' | 'business' {
	const type = c.req.query('type');
	if (type === 'business') return 'business';
	return 'individual';
}

const TAB_ACTIVE =
	'donate-tab donate-tab-active rounded-md bg-[#3B82F6] px-6 py-2 font-medium text-sm text-white transition-all';
const TAB_INACTIVE =
	'donate-tab rounded-md px-6 py-2 font-medium text-sm text-[#94A3B8] transition-all hover:text-white';

function renderDonateContent(ctx: MarketingContext, donationType: 'individual' | 'business'): JSX.Element {
	const isIndividual = donationType === 'individual';
	const isBusiness = donationType === 'business';

	return (
		<section class="mx-auto max-w-3xl">
			<header class="mb-10 text-center">
				<h1 class="mb-4 font-bold text-4xl text-white">Support Echowire</h1>
				<p class="text-lg text-[#94A3B8]">
					Echowire is built on top of the open-source Fluxer project. You can support the instance you use (this one) or the upstream project that makes it possible.
				</p>
			</header>

			<div class="mb-12 grid gap-4 md:grid-cols-2">
				<div class="rounded-xl border-2 border-[#3B82F6] bg-[#101931] p-6">
					<div class="mb-2 font-semibold text-[#3B82F6] text-sm uppercase tracking-wide">This Instance</div>
					<h2 class="mb-3 font-bold text-xl text-white">Support Echowire</h2>
					<p class="mb-4 text-[#94A3B8] text-sm">
						Keeps echowire.org running — covers servers, voice infrastructure, and moderation. Supporters get Echowire Reverb.
					</p>
					<a
						href="#echowire-donate"
						class="inline-flex items-center justify-center rounded-md bg-[#3B82F6] px-4 py-2 font-medium text-sm text-white transition hover:bg-[#2563EB]"
					>
						Donate to Echowire
					</a>
				</div>
				<div class="rounded-xl border border-[#1E293B] bg-[#101931] p-6">
					<div class="mb-2 font-semibold text-[#94A3B8] text-sm uppercase tracking-wide">Upstream Project</div>
					<h2 class="mb-3 font-bold text-xl text-white">Support Fluxer</h2>
					<p class="mb-4 text-[#94A3B8] text-sm">
						Fluxer is the open-source platform Echowire is based on. Supporting Fluxer benefits the entire ecosystem, including us.
					</p>
					<a
						href="https://fluxer.app/donate"
						target="_blank"
						rel="noopener noreferrer"
						class="inline-flex items-center justify-center rounded-md border border-[#1E293B] bg-[#101931] px-4 py-2 font-medium text-[#E2E8F0] text-sm transition hover:bg-[#1A2440]"
					>
						Donate to Fluxer →
					</a>
				</div>
			</div>

			<div id="echowire-donate" class="mb-8 flex justify-center">
				<div class="inline-flex rounded-lg bg-[#1A2440] p-1">
					{renderTab(ctx, 'individual', isIndividual)}
					{renderTab(ctx, 'business', isBusiness)}
				</div>
			</div>

			<div class="mb-6 flex flex-col items-center gap-3">
				{renderDonationForm(ctx, 'individual', !isIndividual)}
				{renderDonationForm(ctx, 'business', !isBusiness)}
				{renderDonateTabScript(ctx)}
				{renderDonationScript(ctx)}
			</div>

			<div id="donation-notes" class="mb-12">
				<p class="text-center text-[#94A3B8] text-sm">
					{ctx.i18n.getMessage('donations.minimum_donation', ctx.locale)}
				</p>
			</div>

			<div class="mt-12 border-[#1E293B] border-t pt-8">
				<h2 class="mb-4 text-center font-semibold text-white text-lg">
					{ctx.i18n.getMessage('donations.manage.title', ctx.locale)}
				</h2>
				<p class="mb-4 text-center text-[#94A3B8] text-sm">
					{ctx.i18n.getMessage('donations.manage.description', ctx.locale)}
				</p>
				{renderDonationManageForm(ctx, '')}
			</div>
		</section>
	);
}

function renderTab(ctx: MarketingContext, type: 'individual' | 'business', isActive: boolean): JSX.Element {
	let label: string;
	if (type === 'individual') {
		label = ctx.i18n.getMessage('donations.individual', ctx.locale);
	} else {
		label = ctx.i18n.getMessage('donations.business', ctx.locale);
	}

	return (
		<a
			id={`donate-tab-${type}`}
			href={href(ctx, `/donate?type=${type}`)}
			onclick={`return switchDonateTab('${type}')`}
			class={isActive ? TAB_ACTIVE : TAB_INACTIVE}
		>
			{label}
		</a>
	);
}

function renderDonateTabScript(ctx: MarketingContext): JSX.Element {
	const individualUrl = href(ctx, '/donate?type=individual');
	const businessUrl = href(ctx, '/donate?type=business');

	return (
		<script
			dangerouslySetInnerHTML={{
				__html: `function switchDonateTab(type) {
  var activeClass = '${TAB_ACTIVE}';
  var inactiveClass = '${TAB_INACTIVE}';
  var individualTab = document.getElementById('donate-tab-individual');
  var businessTab = document.getElementById('donate-tab-business');
  var individualContent = document.getElementById('donate-content-individual');
  var businessContent = document.getElementById('donate-content-business');

  individualTab.className = inactiveClass;
  businessTab.className = inactiveClass;
  individualContent.classList.add('hidden');
  businessContent.classList.add('hidden');

  if (type === 'individual') {
    individualTab.className = activeClass;
    individualContent.classList.remove('hidden');
    history.replaceState(null, '', '${individualUrl}');
  } else {
    businessTab.className = activeClass;
    businessContent.classList.remove('hidden');
    history.replaceState(null, '', '${businessUrl}');
  }
  return false;
}`,
			}}
		/>
	);
}
