/**
 * Generates module-federation.manifest.json for the shell app.
 *
 * Reads remote URLs from environment variables, falling back to localhost for local dev.
 * Run after building the shell: node tools/generate-manifest.mjs
 */
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');

const manifest = {
  orders: process.env.ORDERS_REMOTE_URL
    ? `${process.env.ORDERS_REMOTE_URL}/mf-manifest.json`
    : 'http://localhost:4201/mf-manifest.json',
  productsMf: process.env.PRODUCTS_REMOTE_URL
    ? `${process.env.PRODUCTS_REMOTE_URL}/mf-manifest.json`
    : 'http://localhost:4202/mf-manifest.json',
  cart: process.env.CART_REMOTE_URL
    ? `${process.env.CART_REMOTE_URL}/mf-manifest.json`
    : 'http://localhost:4203/mf-manifest.json',
};

const outputDir = resolve(rootDir, 'dist/apps/shell');

if (!existsSync(outputDir)) {
  mkdirSync(outputDir, { recursive: true });
}

const outputPath = resolve(outputDir, 'module-federation.manifest.json');
writeFileSync(outputPath, JSON.stringify(manifest, null, 2));

console.log('Generated manifest:', JSON.stringify(manifest, null, 2));
console.log('Written to:', outputPath);
