// Composition root: binds the app to a port. No logic lives here, so it is
// excluded from unit coverage and exercised by the E2E smoke test instead.
import { serve } from '@hono/node-server';
import createApp from './app';

const port = Number(process.env.PORT ?? 3000);

serve({ fetch: createApp().fetch, port });
