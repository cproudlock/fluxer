/**
 * Azure Trusted Signing hook for electron-builder.
 *
 * Called by electron-builder's `win.signtoolOptions.sign` config.
 * Uses @azure/trusted-signing-cli to sign Windows executables via
 * Azure Trusted Signing (no local cert required).
 *
 * Required env vars:
 *   AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET,
 *   AZURE_SIGNING_ENDPOINT, AZURE_SIGNING_ACCOUNT, AZURE_CERTIFICATE_PROFILE
 */

import {execFileSync} from 'node:child_process';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default async function sign(configuration) {
	const filePath = configuration.path;

	if (!filePath.endsWith('.exe') && !filePath.endsWith('.dll') && !filePath.endsWith('.msi')) {
		return;
	}

	const endpoint = process.env.AZURE_SIGNING_ENDPOINT;
	const account = process.env.AZURE_SIGNING_ACCOUNT;
	const profile = process.env.AZURE_CERTIFICATE_PROFILE;

	if (!endpoint || !account || !profile) {
		console.log(`[sign] Skipping signing for ${filePath} (Azure env vars not set)`);
		return;
	}

	console.log(`[sign] Signing ${filePath} via Azure Trusted Signing...`);

	const args = [
		resolve(__dirname, '..', 'node_modules', '.bin', 'trusted-signing-cli'),
		'-e', endpoint,
		'-a', account,
		'-c', profile,
		'-f', filePath,
		'-v',
	];

	try {
		execFileSync('node', args, {
			stdio: 'inherit',
			env: {
				...process.env,
				AZURE_TENANT_ID: process.env.AZURE_TENANT_ID,
				AZURE_CLIENT_ID: process.env.AZURE_CLIENT_ID,
				AZURE_CLIENT_SECRET: process.env.AZURE_CLIENT_SECRET,
			},
		});
		console.log(`[sign] Successfully signed ${filePath}`);
	} catch (err) {
		console.error(`[sign] Failed to sign ${filePath}:`, err.message);
		throw err;
	}
}
