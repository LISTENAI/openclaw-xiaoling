import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(
  readFileSync(resolve(here, '..', 'package.json'), 'utf8'),
) as {
  name: string;
  version: string;
};

export const CHANNEL_ID = 'openclaw-xiaoling';

const PREFIX = (pkg.version?.includes('-alpha.') || pkg.version?.includes('-beta.'))
  ? 'staging-' : '';

export const API_BASE = `https://${PREFIX}api.listenai.com`;
export const WS_BASE = `wss://${PREFIX}api.listenai.com/v1/openclaw`;
