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
console.log('');
console.log('(按照提示添加「小聆 AI」)');
console.log('');
console.log('openclaw gateway restart');
console.log('');
console.log('在安装成功后，建议:');
console.log('1. 打开 OpenClaw Control 的代理页面 (http://127.0.0.1:18789/agents)');
console.log('2. 找到 Tools 选项卡');
console.log('3. 找到 openclaw-xiaoling 面板，根据需要启用其中的功能；或直接切换到 Full 预设启用所有工具。然后保存配置');
console.log('4. 重启网关');
