#!/usr/bin/env node
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

const staging = pkg.version?.includes('-alpha.') || pkg.version?.includes('-beta.');

console.log('请依次执行下面的命令安装:');
console.log('');
console.log(`openclaw plugins install npm:${pkg.name}@${staging ? 'beta' : 'latest'}`);
console.log('openclaw gateway restart');
console.log('openclaw channels add');
console.log('(按照提示添加「小聆 AI」)');
console.log('openclaw gateway restart');
