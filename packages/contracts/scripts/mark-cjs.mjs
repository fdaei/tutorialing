// The package is `"type": "module"`, which makes every bare `.js` under it ESM
// — including the CommonJS build, whose `require()` calls would then throw at
// runtime. A nested package.json marks that one directory as CommonJS, which is
// the standard way to ship both formats from a single `"type": "module"`
// package without renaming every emitted file to `.cjs`.
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = join(dirname(dirname(fileURLToPath(import.meta.url))), 'dist', 'cjs');
mkdirSync(dist, { recursive: true });
writeFileSync(join(dist, 'package.json'), `${JSON.stringify({ type: 'commonjs' }, null, 2)}\n`);
