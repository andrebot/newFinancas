import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { serveStatic } from '@hono/node-server/serve-static';
import type { MiddlewareHandler } from 'hono';
import { http } from '../config/constants';
import type { AppEnv } from './errorHandler';

// The built web app, served by the API when self-hosted (N10 S1, OQ-250): one
// origin for the app and `/api/v1`, so the security headers and CSP set in
// Hono cover both. Only GET and HEAD outside the API are answered here.
// A file that exists is served as is; any other path is a route of the
// single-page app and gets index.html, except under assets/, where a missing
// file is a 404 rather than HTML served as a script.

const ASSETS_PREFIX = '/assets/';
const { webAppCache } = http;

/**
 * Tells whether a request is the web app's to answer.
 *
 * @param method - The request method.
 * @param path - The request path.
 * @returns `true` for a GET or HEAD outside `/api/` and `/health`.
 */
export const isWebAppRequest = (method: string, path: string): boolean => (
  (method === 'GET' || method === 'HEAD') && !path.startsWith('/api/') && path !== '/health'
);

/**
 * Checks, at startup, that a folder holds the built web app, so a wrong
 * `WEB_DIST_DIR` stops the API instead of serving 404s.
 *
 * @param distDir - The configured web build folder.
 * @param canRead - Resolves when the file exists (default: `fs.access`).
 * @returns Resolves when `index.html` is there; rejects with a clear error otherwise.
 */
export const requireWebBuild = async (
  distDir: string,
  canRead: (file: string) => Promise<void> = access,
): Promise<void> => {
  const indexFile = join(distDir, 'index.html');
  await canRead(indexFile).catch(() => {
    throw new Error(`WEB_DIST_DIR holds no built web app: ${indexFile} is missing`);
  });
};

/** Lets serveStatic report "not found" back to the caller instead of moving on. */
const stopHere = async (): Promise<void> => {};

/**
 * Creates the middleware that serves the built web app.
 *
 * @param distDir - The absolute path of the web build (`WEB_DIST_DIR`).
 * @returns Middleware answering the app's files and routes; anything else passes on.
 */
const createWebApp = (distDir: string): MiddlewareHandler<AppEnv> => {
  const files = serveStatic<AppEnv>({ root: distDir });
  const indexPage = serveStatic<AppEnv>({ root: distDir, path: 'index.html' });
  return async (httpContext, next) => {
    if (!isWebAppRequest(httpContext.req.method, httpContext.req.path)) return next();
    const isAsset = httpContext.req.path.startsWith(ASSETS_PREFIX);
    const found = await files(httpContext, stopHere)
      ?? (isAsset ? undefined : await indexPage(httpContext, stopHere));
    if (!found) return next();
    // Set on the response itself: serveStatic has already built it.
    found.headers.set(
      'Cache-Control',
      isAsset ? webAppCache.hashedAssets : webAppCache.everythingElse,
    );
    return found;
  };
};

export default createWebApp;
