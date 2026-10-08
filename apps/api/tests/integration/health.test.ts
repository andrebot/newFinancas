import { zError } from '@financas/api-types/zod';
import { createAdaptorServer } from '@hono/node-server';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import createApp from '../../src/app';

/**
 * Starts the real app on an ephemeral Node server for Supertest.
 *
 * @returns The Node HTTP server.
 */
const server = () => createAdaptorServer({
  fetch: createApp({ onUnexpectedError: () => {} }).fetch,
});

describe('GET /health', () => {
  it('responds 200 with status ok', async () => {
    const response = await request(server()).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });
});

describe('unknown routes', () => {
  it('respond 404 with the contract error envelope', async () => {
    const response = await request(server()).get('/nope');

    expect(response.status).toBe(404);
    expect(zError.parse(response.body).error.code).toBe('route.not_found');
  });
});
