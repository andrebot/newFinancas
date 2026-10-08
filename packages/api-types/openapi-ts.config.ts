import { defineConfig } from '@hey-api/openapi-ts';

// Generates the API contract code from the spec (docs/architecture/api/openapi.yaml
// is the contract). Output is committed; `pnpm check:contract` fails if it is stale.
export default defineConfig({
  input: '../../docs/architecture/api/openapi.yaml',
  output: { path: 'src/generated', entryFile: false },
  plugins: ['@hey-api/typescript', 'zod'],
});
