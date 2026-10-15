import { fireEvent, screen, within } from '@testing-library/react';
import {
  describe, expect, it, vi,
} from 'vitest';
import {
  deviceName, SessionList, sessionMeta, type SessionListProps,
} from '../../../../../../../src/experiences/manageProfile/flows/security/interactions/SessionList';
import type {
  SecuritySession,
} from '../../../../../../../src/experiences/manageProfile/flows/security/securityState';
import { createTranslator } from '../../../../../../../src/utilities/i18n';
import { renderInLocale } from '../../../../../../support/renderInLocale';

// Interaction (BDT: unit, display state in, events out): the real kit,
// translator and User-Agent reader (Utilities); only the Flow's handlers are
// stand-ins.

const CHROME_MAC = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
  'AppleWebKit/537.36 (KHTML, like Gecko)',
  'Chrome/129.0.0.0 Safari/537.36',
].join(' ');
const SAFARI_IPHONE = [
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X)',
  'AppleWebKit/605.1.15 (KHTML, like Gecko)',
  'Version/17.6 Mobile/15E148 Safari/604.1',
].join(' ');

const THIS: SecuritySession = {
  id: 'this',
  deviceInfo: CHROME_MAC,
  createdAt: '2026-08-01T12:00:00Z',
  lastUsedAt: '2026-10-15T12:00:00Z',
  current: true,
};
const PHONE: SecuritySession = {
  id: 'phone',
  deviceInfo: SAFARI_IPHONE,
  createdAt: '2026-07-15T12:00:00Z',
  lastUsedAt: '2026-09-20T12:00:00Z',
  current: false,
};
const UNKNOWN: SecuritySession = {
  id: 'unknown',
  deviceInfo: null,
  createdAt: '2026-06-02T12:00:00Z',
  lastUsedAt: '2026-08-10T12:00:00Z',
  current: false,
};

/**
 * Renders the list with stand-in handlers, in en-US.
 *
 * @param props - The props to set or override.
 * @returns The handlers.
 */
const renderList = (props: Partial<SessionListProps> = {}) => {
  const handlers = { onRevoke: vi.fn(), onRetry: vi.fn() };
  renderInLocale(
    <SessionList
      sessions={{ status: 'loaded', sessions: [THIS, PHONE, UNKNOWN] }}
      revokeLocked={false}
      {...handlers}
      {...props}
    />,
  );
  return handlers;
};

const rows = () => screen.getAllByRole('listitem');
const revokeOf = (device: string) => screen.getByRole<HTMLButtonElement>(
  'button',
  { name: `Revoke ${device}` },
);

describe('SessionList — the rows', () => {
  it('names each device, tags this one and gives the others a Revoke', () => {
    renderList();

    expect(screen.getByRole('heading', { level: 2, name: 'Active sessions' })).toBeTruthy();
    expect(rows()).toHaveLength(3);
    const [thisRow, phoneRow, unknownRow] = rows() as [HTMLElement, HTMLElement, HTMLElement];
    expect(thisRow.textContent).toContain('Chrome on macOS');
    expect(within(thisRow).getByText('This device')).toBeTruthy();
    expect(within(thisRow).getByText('Signed in 08/01/2026 · Active now')).toBeTruthy();
    expect(within(thisRow).queryByRole('button')).toBeNull();
    expect(phoneRow.textContent).toContain('Safari on iOS');
    expect(within(phoneRow).getByText('Signed in 07/15/2026 · Last used 09/20/2026')).toBeTruthy();
    expect(unknownRow.textContent).toContain('Unknown device');
  });

  it('emits the revoke of the row clicked', () => {
    const { onRevoke } = renderList();

    fireEvent.click(revokeOf('Safari on iOS'));

    expect(onRevoke).toHaveBeenCalledWith('phone');
  });

  it('spins the revoke that is out and holds the others', () => {
    renderList({ revokingId: 'phone', revokeLocked: true });

    expect(revokeOf('Safari on iOS').getAttribute('aria-busy')).toBe('true');
    expect(revokeOf('Unknown device').disabled).toBe(true);
  });

  it("draws the Flow's header action, confirm and failure", () => {
    renderList({
      headerAction: <button type="button">all others</button>,
      confirm: <p>are you sure?</p>,
      alert: 'Session not found.',
    });

    expect(screen.getByRole('button', { name: 'all others' })).toBeTruthy();
    expect(screen.getByText('are you sure?')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toContain('Session not found.');
  });
});

describe('SessionList — loading and failure', () => {
  it('shows skeleton rows while loading', () => {
    renderList({ sessions: { status: 'loading' } });

    expect(screen.getByRole('status', { name: 'Loading sessions' })).toBeTruthy();
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('shows a failed load with a retry', () => {
    const { onRetry } = renderList({
      sessions: { status: 'failed', error: { code: 'network.unavailable' } },
    });

    expect(screen.getByRole('alert').textContent)
      .toContain("Couldn't connect. Check your connection and try again.");
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe('SessionList — the texts', () => {
  const translator = createTranslator('pt-BR');

  it('names a device by both brands, the one known, or neither', () => {
    expect(deviceName({ browser: 'Chrome', system: 'macOS', kind: 'laptop' }, translator))
      .toBe('Chrome no macOS');
    expect(deviceName({ browser: 'Chrome', kind: 'unknown' }, translator)).toBe('Chrome');
    expect(deviceName({ system: 'Windows', kind: 'desktop' }, translator)).toBe('Windows');
    expect(deviceName({ kind: 'unknown' }, translator)).toBe('Dispositivo desconhecido');
  });

  it("dates the meta line in the locale's order", () => {
    expect(sessionMeta(THIS, translator)).toBe('Entrou em 01/08/2026 · Ativa agora');
    expect(sessionMeta(PHONE, translator))
      .toBe('Entrou em 15/07/2026 · Último uso em 20/09/2026');
  });
});
