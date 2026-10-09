import { zError } from '@financas/api-types/zod';
import { captureLogs } from '@financas/logging';
import { createAdaptorServer } from '@hono/node-server';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import createApp from '../../src/app';

/**
 * Starts the real app on an ephemeral Node server for Supertest.
 *
 * @returns The Node HTTP server.
 */
const server = () => createAdaptorServer({ fetch: createApp().fetch });

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
    const logs = captureLogs();
    const response = await request(server()).get('/health');
    logs.stop();

    expect(logs.events).toContainEqual(expect.objectContaining({
      level: 'info',
      label: 'http',
      message: 'GET /health',
      correlationId: response.headers['x-correlation-id'],
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
  it('are logged with their stack and the request\'s correlation id', async () => {
    const app = createApp();
    app.get('/boom', () => {
      throw new Error('database unreachable');
    });
    const logs = captureLogs();

    const response = await request(createAdaptorServer({ fetch: app.fetch })).get('/boom');
    logs.stop();

    expect(response.status).toBe(500);
    expect(logs.events).toContainEqual(expect.objectContaining({
      level: 'error',
      message: 'Unexpected error: database unreachable',
      correlationId: response.headers['x-correlation-id'],
      stack: expect.stringContaining('database unreachable'),
    }));
  });
});
