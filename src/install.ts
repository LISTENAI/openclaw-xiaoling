#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const [, , command, ...rest] = process.argv;

if (command !== 'install') {
  console.error('用法: npx -y @listenai/openclaw-xiaoling install');
  process.exit(1);
}

const here = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(
  readFileSync(resolve(here, '..', 'package.json'), 'utf8'),
) as {
  name: string;
  version: string;
  openclaw?: { channel?: { id?: string } };
};
const spec = `npm:${pkg.name}@${pkg.version}`;
const channelId = pkg.openclaw?.channel?.id;

if (!channelId) {
  console.error('package.json 缺少 openclaw.channel.id 字段');
  process.exit(1);
}

function runOpenclaw(args: string[]): void {
  const result = spawnSync('openclaw', args, { stdio: 'inherit' });

  if (result.error) {
    if ((result.error as NodeJS.ErrnoException).code === 'ENOENT') {
      console.error('找不到 openclaw 命令。请先安装并配置 OpenClaw：');
      console.error('');
      console.error('    https://docs.openclaw.ai/start/getting-started');
      process.exit(1);
    }
    throw result.error;
  }

  if ((result.status ?? 0) !== 0) {
    process.exit(result.status ?? 1);
  }
}

runOpenclaw(['plugins', 'install', spec, ...rest]);
runOpenclaw(['channels', 'add', '--channel', channelId]);
