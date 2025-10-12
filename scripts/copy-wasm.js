import { copyFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const staticDir = join(__dirname, '..', 'static');

// Ensure static directory exists
if (!existsSync(staticDir)) {
  mkdirSync(staticDir, { recursive: true });
}

// Copy worker.js
const workerSrc = join(__dirname, '..', 'node_modules', '@nostr-dev-kit', 'cache-sqlite-wasm', 'dist', 'worker.js');
const workerDest = join(staticDir, 'worker.js');

// Copy sql-wasm.wasm
const wasmSrc = join(__dirname, '..', 'node_modules', '@nostr-dev-kit', 'cache-sqlite-wasm', 'dist', 'sql-wasm.wasm');
const wasmDest = join(staticDir, 'sql-wasm.wasm');

try {
  copyFileSync(workerSrc, workerDest);
  console.log('✅ Copied worker.js to static/');

  copyFileSync(wasmSrc, wasmDest);
  console.log('✅ Copied sql-wasm.wasm to static/');
} catch (error) {
  console.error('❌ Error copying WASM files:', error);
  process.exit(1);
}
