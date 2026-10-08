import { createAdaptorServer } from '@hono/node-server';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import createApp from '../../src/app';

describe('GET /health', () => {
  it('responds 200 with status ok', async () => {
    const server = createAdaptorServer({ fetch: createApp().fetch });

    const response = await request(server).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });

  it('responds 404 for unknown routes', async () => {
    const server = createAdaptorServer({ fetch: createApp().fetch });

    const response = await request(server).get('/nope');

    expect(response.status).toBe(404);
  });
});
