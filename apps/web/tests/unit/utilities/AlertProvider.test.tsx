import {
  act, fireEvent, render, screen,
} from '@testing-library/react';
import type { ReactNode } from 'react';
import {
  describe, expect, it, vi,
} from 'vitest';
import type { ToastProps } from '../../../src/kit/alert/Toast';
import { AlertProvider, alertsOf, useAlerts } from '../../../src/utilities/AlertProvider';
import { createAlertQueue, type AlertQueue } from '../../../src/utilities/alerts';
import { renderInLocale } from '../../support/renderInLocale';

// AlertUtility's React binding (BDT: Utility → unit, mock the rendering sink).
// The kit's toast and region are replaced by stand-ins that show what they
// were given; the queue and the translator are the real ones.

vi.mock('../../../src/kit/alert/Toast', () => ({
  /**
   * Stands in for the toast: shows its props and offers its two callbacks.
   *
   * @param props - The toast's props.
   * @returns The stand-in.
   */
  Toast: ({
    tone, message, duration, dismissLabel, onDismiss, action,
  }: ToastProps) => (
    <div data-testid="toast" data-tone={tone} data-duration={String(duration)}>
      {message}
      {action && <button type="button" onClick={action.onAction}>{action.label}</button>}
      <button type="button" onClick={onDismiss}>{dismissLabel}</button>
    </div>
  ),
  /**
   * Stands in for the region: a named section, not portalled.
   *
   * @param props - The region's name and its toasts.
   * @returns The stand-in.
   */
  ToastRegion: ({ label, children }: { label: string; children?: ReactNode }) => (
    <section aria-label={label}>{children}</section>
  ),
}));

/**
 * Asks for a toast of each kind its buttons name.
 *
 * @returns The probe's buttons.
 */
function Probe() {
  const alerts = useAlerts();
  return (
    <>
      <button type="button" onClick={() => alerts.success('Saved')}>success</button>
      <button
        type="button"
        onClick={() => alerts.error('Offline', { action: { label: 'Retry', onAction: () => {} } })}
      >
        error
      </button>
    </>
  );
}

/**
 * Renders the probe under a provider over a fresh queue.
 *
 * @param locale - The locale the provider's labels render in.
 * @returns The queue.
 */
const renderProbe = (locale: 'en-US' | 'pt-BR' = 'en-US'): AlertQueue => {
  const queue = createAlertQueue(3);
  renderInLocale(<AlertProvider queue={queue}><Probe /></AlertProvider>, locale);
  return queue;
};

describe('alertsOf', () => {
  it('queues each call in its own tone, with its options', () => {
    const queue = createAlertQueue(5);
    const alerts = alertsOf(queue);
    alerts.success('A');
    alerts.info('B', { duration: 1000 });
    alerts.warning('C');
    const id = alerts.error('D', { duration: null });

    expect(queue.visible()).toEqual([
      expect.objectContaining({ tone: 'success', message: 'A' }),
      expect.objectContaining({ tone: 'info', message: 'B', duration: 1000 }),
      expect.objectContaining({ tone: 'warning', message: 'C' }),
      {
        id, tone: 'error', message: 'D', duration: null,
      },
    ]);
    alerts.dismiss(id);
    expect(queue.visible()).toHaveLength(3);
  });
});

describe('AlertProvider', () => {
  it('draws an empty, named region in the locale', () => {
    renderProbe('pt-BR');
    expect(screen.getByRole('region', { name: 'Avisos' }).childElementCount).toBe(0);
  });

  it('draws the toasts components ask for, with the dismiss label', () => {
    renderProbe();
    fireEvent.click(screen.getByRole('button', { name: 'success' }));
    fireEvent.click(screen.getByRole('button', { name: 'error' }));

    const toasts = screen.getAllByTestId('toast');
    expect(toasts.map((toast) => toast.dataset.tone)).toEqual(['success', 'error']);
    expect(toasts[0]?.textContent).toContain('Saved');
    expect(toasts[0]?.dataset.duration).toBe('undefined');
    expect(screen.getAllByRole('button', { name: 'Retry' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Dismiss' })).toHaveLength(2);
  });

  it('removes a toast when it is dismissed', () => {
    renderProbe();
    fireEvent.click(screen.getByRole('button', { name: 'success' }));
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));

    expect(screen.queryByTestId('toast')).toBeNull();
  });

  it('follows changes made to the queue directly', () => {
    const queue = renderProbe();
    act(() => {
      queue.show({ tone: 'info', message: 'Synced', duration: 2000 });
    });

    expect(screen.getByTestId('toast').dataset.duration).toBe('2000');
  });
});

describe('useAlerts', () => {
  it('fails loudly when a component reads it outside the provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow('useAlerts must be used inside an AlertProvider');
    vi.restoreAllMocks();
  });
});
