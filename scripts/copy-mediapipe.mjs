// Copies the MediaPipe vision WASM runtime into public/ so it is served from
// our own origin (no CDN at runtime). Runs automatically before dev/build.
import { cpSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'node_modules/@mediapipe/tasks-vision/wasm');
const dest = join(root, 'public/mediapipe/wasm');

const files = [
  'vision_wasm_internal.js',
  'vision_wasm_internal.wasm',
  'vision_wasm_nosimd_internal.js',
  'vision_wasm_nosimd_internal.wasm',
];

mkdirSync(dest, { recursive: true });
for (const file of files) cpSync(join(src, file), join(dest, file));
console.log(`[mediapipe] copied ${files.length} wasm files to public/mediapipe/wasm`);
