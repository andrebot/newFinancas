// Composition root: reads the environment and binds the app to a port. No
// logic lives here, so it is excluded from unit coverage and exercised by the
// E2E smoke test instead.
import { serve } from '@hono/node-server';
import createApp from './app';
import loadConfig from './config/loadConfig';

const config = loadConfig(process.env);

serve({ fetch: createApp().fetch, port: config.port });
