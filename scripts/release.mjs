import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
await fs.mkdir(path.join(root, 'releases'), { recursive: true });
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const result = spawnSync(npm, ['pack', '--pack-destination', 'releases'], { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });
if (result.status !== 0) process.exit(result.status || 1);
