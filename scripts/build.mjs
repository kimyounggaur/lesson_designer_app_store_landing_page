// 배포용 dist/ 만들기: 부품 파일 + apps.json + icons/
import { cp, mkdir, rm } from 'node:fs/promises';
import { buildLandingData } from './build-data.mjs';

const root = new URL('../', import.meta.url);
const output = new URL('dist/', root);
const publicPaths = ['claw-machine.js', 'styles.css', 'src', 'demo.html'];

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await Promise.all(publicPaths.map((path) => cp(new URL(path, root), new URL(path, output), { recursive: true })));
const data = await buildLandingData(root, output);
console.log(`dist/apps.json: ${data.apps.length} apps`);
