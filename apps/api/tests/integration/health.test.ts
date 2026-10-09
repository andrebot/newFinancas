import { zError } from '@financas/api-types/zod';
import { createAdaptorServer } from '@hono/node-server';
import request from 'supertest';
import {
  describe, expect, it, vi,
} from 'vitest';
import createApp from '../../src/app';

/**
 * Starts the real app on an ephemeral Node server for Supertest.
 *
 * @returns The Node HTTP server.
 */
const logging = { logError: vi.fn(), logRequest: vi.fn() };
const server = () => createAdaptorServer({ fetch: createApp({ logging }).fetch });

describe('GET /health', () => {
  it('responds 200 with status ok', async () => {
    const response = await request(server()).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
    expect(response.headers['x-correlation-id']).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe('request logging (NFR-OBS-1)', () => {
  it('logs every request with its correlation id', async () => {
    const response = await request(server()).get('/health');

    expect(logging.logRequest).toHaveBeenCalledWith(expect.objectContaining({
      correlationId: response.headers['x-correlation-id'],
      method: 'GET',
      path: '/health',
      status: 200,
    }));
  });
});

describe('unknown routes', () => {
  it('respond 404 with the contract error envelope', async () => {
    const response = await request(server()).get('/nope');

    const body = zError.parse(response.body);

    expect(response.status).toBe(404);
    expect(body.error.code).toBe('route.not_found');
    expect(body.error.correlationId).toBe(response.headers['x-correlation-id']);
  });
});

describe('unexpected errors', () => {
  it('are reported to logError with the request\'s correlation id', async () => {
    const app = createApp({ logging });
    const failure = new Error('database unreachable');
    app.get('/boom', () => {
      throw failure;
    });

    const response = await request(createAdaptorServer({ fetch: app.fetch })).get('/boom');

    expect(response.status).toBe(500);
    expect(logging.logError).toHaveBeenCalledWith({
      correlationId: response.headers['x-correlation-id'],
      actor: 'unauthenticated',
      action: 'http.unexpected_error',
      error: failure,
    });
  });
});
