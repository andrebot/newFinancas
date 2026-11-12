import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { daysAgo, isoDay } from '../support/financeApi';
import {
  addMember, createHousehold, currentUser, registerUser,
} from '../support/identityApi';
import { exportAuditLog } from '../support/insightsApi';
import { signInThroughUi, signOut } from '../support/signIn';
import text from '../support/text';

// I11 — Export Audit Log (X8; mockup 24; FR-7.2) against the real API: Core
// E2E journey #12. A Viewer is refused before any CSV is built: the drawer
// doesn't offer them the export, so the 403 is asked for through the API. An
// Owner downloads it through the drawer's dialog — a centred 440px card whose
// scrim covers the header too (K21, OQ-241) — and gets the file the API
// writes for those days, holding the household's setup.

/** The export dialog's width from `md` up (K21). */
const DIALOG_WIDTH_PX = 440;

/**
 * Opens the navigation drawer and waits for it to show, its Sign out at its foot.
 *
 * @param page - The browser page, signed in.
 * @returns The drawer, open.
 */
const openDrawer = async (page: Page) => {
  await page.getByRole('button', { name: text('shell', 'header.openMenu') }).click();
  const drawer = page.getByRole('navigation', { name: text('shell', 'drawer.label') });
  await expect(drawer.getByRole('button', { name: text('shell', 'account.signOut') }))
    .toBeVisible();
  return drawer;
};

/**
 * The class of the topmost element at a point of the page.
 *
 * @param page - The browser page.
 * @param point - The point, in viewport pixels.
 * @returns Its `class` attribute, empty when it has none.
 */
const classAt = (page: Page, point: { readonly x: number; readonly y: number }) => (
  // An expression, not a function: the E2E code compiles without the DOM's types.
  page.evaluate<string>(
    `document.elementFromPoint(${point.x}, ${point.y})?.getAttribute('class') ?? ''`,
  )
);

test('a Viewer is refused the audit log and an Owner downloads it', {
  tag: '@core',
}, async ({ page, request }) => {
  const owner = await registerUser(request, { firstName: 'Otto', lastName: 'Owner' });
  const viewer = await registerUser(request, { firstName: 'Vera', lastName: 'Viewer' });
  const household = await createHousehold(request, owner, 'Audit Home');
  await addMember(request, owner, household.id, { user: viewer, role: 'Viewer' });
  const ownerId = (await currentUser(request, owner.accessToken)).id;
  const viewerId = (await currentUser(request, viewer.accessToken)).id;
  // Today: the runner, the browser and the API share São Paulo's calendar
  // (playwright.config.ts), so the setup's entries are today's.
  const today = isoDay(new Date());
  const todayOnly = { startDate: today, endDate: today };

  // The Viewer: no export in the open drawer, and the API refuses it.
  await signInThroughUi(page, viewer);
  const viewerDrawer = await openDrawer(page);
  await expect(viewerDrawer.getByText(text('shell', 'records.title'))).toHaveCount(0);
  await expect(viewerDrawer.getByRole('button', { name: text('shell', 'records.exportAuditLog') }))
    .toHaveCount(0);
  const refused = await exportAuditLog(request, viewer, household.id, todayOnly);
  expect(refused.status).toBe(403);
  expect(JSON.parse(refused.body)).toMatchObject({ error: { code: 'auth.forbidden' } });
  await page.keyboard.press('Escape');
  await signOut(page);

  // The audit sink stores entries in the background (OQ-110): wait for the
  // setup's last one before the Owner asks.
  const ownerExport = () => exportAuditLog(request, owner, household.id, todayOnly);
  await expect.poll(async () => (await ownerExport()).body)
    .toContain(`,${viewerId},AcceptInvitation,`);

  // The Owner: the drawer's export, in its dialog.
  await signInThroughUi(page, owner);
  const ownerDrawer = await openDrawer(page);
  await ownerDrawer.getByRole('button', { name: text('shell', 'records.exportAuditLog') }).click();
  const dialog = page.getByRole('dialog', { name: text('auditExport', 'title') });
  await expect(dialog).toHaveAttribute('data-status', 'open');
  await expect(dialog).toContainText(text('auditExport', 'subtitle', { household: 'Audit Home' }));

  // Its geometry (OQ-241): a 440px card in the middle, the scrim over the header.
  const viewport = page.viewportSize()!;
  const card = (await dialog.boundingBox())!;
  expect(card.width).toBe(DIALOG_WIDTH_PX);
  expect(Math.abs(card.x + card.width / 2 - viewport.width / 2)).toBeLessThanOrEqual(1);
  expect(Math.abs(card.y + card.height / 2 - viewport.height / 2)).toBeLessThanOrEqual(1);
  // The modal hides the page behind it from the accessibility tree: find it by its tag.
  const header = (await page.locator('header').first().boundingBox())!;
  const headerMiddle = { x: header.x + header.width / 2, y: header.y + header.height / 2 };
  expect(await classAt(page, headerMiddle)).toContain('bg-scrim');

  // Last 30 days is chosen already: download it.
  const downloaded = page.waitForEvent('download');
  await dialog.getByRole('button', { name: text('auditExport', 'download') }).click();
  const download = await downloaded;
  await expect(page.getByText(text('auditExport', 'done'))).toBeVisible();
  await expect(dialog).toHaveCount(0);

  // Last 30 days: the 30 days ending today, both included (`lastDays` in the
  // kit's presets). The file is named by them and is the API's for them.
  const lastThirtyDays = { startDate: isoDay(daysAgo(29)), endDate: today };
  expect(download.suggestedFilename())
    .toBe(`audit-log-${lastThirtyDays.startDate}-${lastThirtyDays.endDate}.csv`);
  const csv = await readFile(await download.path(), 'utf8');
  const expected = await exportAuditLog(request, owner, household.id, lastThirtyDays);
  expect(expected.status).toBe(200);
  expect(csv).toBe(expected.body);
  const [columns, ...rows] = csv.trim().split(/\r?\n/);
  expect(columns).toBe('timestamp,actor_id,action,entity_type,entity_id');
  const actions = rows.map((row) => row.split(',').slice(1, 3).join(','));
  expect(actions).toEqual(expect.arrayContaining([
    `${ownerId},CreateHousehold`,
    `${ownerId},InviteUser`,
    `${viewerId},AcceptInvitation`,
  ]));
  expect(rows).toContainEqual(
    expect.stringContaining(`,${ownerId},CreateHousehold,Household,${household.id}`),
  );
});
