/**
 * Post-build script that patches `requiredVersion:"auto"` in Federation Runtime
 * output. Nx's `withModuleFederation` leaves 'auto' unresolved on the consume
 * side, causing runtime errors in production deployments.
 *
 * Usage: node tools/patch-auto-versions.mjs dist/apps/shell dist/apps/cart ...
 */
import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const PATTERN = /requiredVersion:"auto",strictVersion:!0/g;
const REPLACEMENT = 'requiredVersion:false,strictVersion:!1';

const dirs = process.argv.slice(2);
if (dirs.length === 0) {
  console.error('Usage: node tools/patch-auto-versions.mjs <dist-dir> [<dist-dir> ...]');
  process.exit(1);
}

let totalPatched = 0;

for (const dir of dirs) {
  const files = readdirSync(dir).filter((f) => f.endsWith('.js'));
  for (const file of files) {
    const filePath = join(dir, file);
    const content = readFileSync(filePath, 'utf-8');
    const matches = content.match(PATTERN);
    if (matches) {
      const patched = content.replace(PATTERN, REPLACEMENT);
      writeFileSync(filePath, patched);
      console.log(`Patched ${matches.length} occurrence(s) in ${filePath}`);
      totalPatched += matches.length;
    }
  }
}

console.log(`Done. Patched ${totalPatched} total occurrence(s) across ${dirs.length} app(s).`);
