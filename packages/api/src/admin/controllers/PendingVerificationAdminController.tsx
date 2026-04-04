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

import {requireAdminACL} from '@fluxer/api/src/middleware/AdminMiddleware';
import type {HonoApp} from '@fluxer/api/src/types/HonoEnv';
import {AdminACLs} from '@fluxer/constants/src/AdminACLs';

export function PendingVerificationAdminController(app: HonoApp) {
	app.post('/admin/pending-verifications/list', requireAdminACL(AdminACLs.WILDCARD), async (ctx) => {
		return ctx.json({pending_verifications: []});
	});
	app.post('/admin/pending-verifications/approve', requireAdminACL(AdminACLs.WILDCARD), async (ctx) => {
		return ctx.json({success: true});
	});
	app.post('/admin/pending-verifications/reject', requireAdminACL(AdminACLs.WILDCARD), async (ctx) => {
		return ctx.json({success: true});
	});
	app.post('/admin/pending-verifications/bulk-approve', requireAdminACL(AdminACLs.WILDCARD), async (ctx) => {
		return ctx.json({success: true});
	});
	app.post('/admin/pending-verifications/bulk-reject', requireAdminACL(AdminACLs.WILDCARD), async (ctx) => {
		return ctx.json({success: true});
	});
	app.post('/admin/feature-flags/get', requireAdminACL(AdminACLs.WILDCARD), async (ctx) => {
		return ctx.json({feature_flags: {}});
	});
	app.post('/admin/feature-flags/update', requireAdminACL(AdminACLs.WILDCARD), async (ctx) => {
		return ctx.json({success: true});
	});
}
