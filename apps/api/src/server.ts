// Composition root: reads the environment, wires dependencies and binds the app
// to a port. No logic lives here, so it is excluded from unit coverage and
// exercised by the E2E smoke test instead.
import { serve } from '@hono/node-server';
import createApp from './app';
import loadEnv from './config/env';

const config = loadEnv(process.env);

// Until LoggingUtility (U2) exists, unexpected errors go to stderr.
// eslint-disable-next-line no-console
const app = createApp({ onUnexpectedError: (err) => console.error(err) });

serve({ fetch: app.fetch, port: config.port });
