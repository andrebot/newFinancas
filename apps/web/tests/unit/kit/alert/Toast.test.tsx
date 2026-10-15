import {
  act, fireEvent, render, screen,
} from '@testing-library/react';
import {
  afterEach, beforeEach, describe, expect, it, vi,
} from 'vitest';
import { toast } from '../../../../src/config/constants';
import { Toast, ToastRegion } from '../../../../src/kit/alert/Toast';

// Kit component (BDT: Interaction tier → unit): nothing mocked but the clock;
// the real useAutoDismiss, Button and IconButton run.

describe('Toast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the message politely, with the tone glyph and a named close button', () => {
    const onDismiss = vi.fn();
    render(
      <Toast
        tone="success"
        message="Transação salva."
        onDismiss={onDismiss}
        dismissLabel="Dispensar"
      />,
    );

    const toastElement = screen.getByRole('status');
    expect(toastElement.textContent).toContain('Transação salva.');
    expect(toastElement.querySelector('svg')!.getAttribute('class')).toContain('text-mint');

    fireEvent.click(screen.getByRole('button', { name: 'Dispensar' }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('closes a success toast after the default time', () => {
    const onDismiss = vi.fn();
    render(
      <Toast tone="success" message="Salvo." onDismiss={onDismiss} dismissLabel="Dispensar" />,
    );

    act(() => vi.advanceTimersByTime(toast.durationMs));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('keeps an error until closed, announced at once', () => {
    const onDismiss = vi.fn();
    render(
      <Toast tone="error" message="Falhou." onDismiss={onDismiss} dismissLabel="Dispensar" />,
    );

    act(() => vi.advanceTimersByTime(toast.durationMs * 10));
    expect(onDismiss).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('follows the duration it is given', () => {
    const onDismiss = vi.fn();
    render(
      <Toast
        tone="warning"
        message="Atenção."
        onDismiss={onDismiss}
        dismissLabel="Dispensar"
        duration={2000}
      />,
    );

    act(() => vi.advanceTimersByTime(2000));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('stays while hovered', () => {
    const onDismiss = vi.fn();
    render(<Toast tone="info" message="Nota." onDismiss={onDismiss} dismissLabel="Dispensar" />);

    fireEvent.pointerEnter(screen.getByRole('status'));
    act(() => vi.advanceTimersByTime(toast.durationMs * 2));
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('runs its action, then closes', () => {
    const calls: string[] = [];
    render(
      <Toast
        tone="error"
        message="Falhou."
        dismissLabel="Dispensar"
        onDismiss={() => calls.push('dismiss')}
        action={{ label: 'Tentar de novo', onAction: () => calls.push('action') }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(calls).toEqual(['action', 'dismiss']);
  });

  it('has only the close button without an action', () => {
    render(<Toast tone="info" message="Nota." onDismiss={vi.fn()} dismissLabel="Dispensar" />);

    expect(screen.getAllByRole('button')).toHaveLength(1);
  });
});

describe('ToastRegion', () => {
  it('stacks its toasts in a named region on <body>', () => {
    const { container } = render(
      <ToastRegion label="Notificações">
        <p>Primeiro</p>
        <p>Segundo</p>
      </ToastRegion>,
    );

    const region = screen.getByRole('region', { name: 'Notificações' });
    expect(region.parentElement).toBe(document.body);
    expect(container.contains(region)).toBe(false);
    expect(region.textContent).toBe('PrimeiroSegundo');
  });
});
