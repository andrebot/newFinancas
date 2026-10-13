// Composition root for the icon generator (OQ-126): reads the Iconify
// collections, builds the registry from the selection and writes it into the
// web kit. No logic lives here, so it is excluded from unit coverage;
// `pnpm check:icons` runs it and fails when the committed registry is stale.
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { createLogger } from '@financas/logging';
import { CATEGORY_ICONS } from '@financas/reference';
import { buildIconModule, type IconCollection } from './buildModule';
import { CARD_NETWORK_LOGOS, UI_ICONS } from './selection';

const OUTPUT = path.resolve(
  import.meta.dirname,
  '../../../apps/web/src/kit/icons/generated/iconData.ts',
);

const logger = createLogger({ label: 'icons', actor: 'system' });
const requireJson = createRequire(import.meta.url);

const source = buildIconModule(
  {
    glyphs: requireJson('@iconify-json/material-symbols/icons.json') as IconCollection,
    logos: requireJson('@iconify-json/logos/icons.json') as IconCollection,
  },
  { glyphs: [...UI_ICONS, ...CATEGORY_ICONS], logos: CARD_NETWORK_LOGOS },
);

await mkdir(path.dirname(OUTPUT), { recursive: true });
await writeFile(OUTPUT, source);
logger.info(`Icon registry written to ${path.relative(process.cwd(), OUTPUT)}`);
