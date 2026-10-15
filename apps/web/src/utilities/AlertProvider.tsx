import {
  createContext, useContext, useMemo, useSyncExternalStore, type ReactNode,
} from 'react';
import type { AlertTone } from '../kit/alert/tones';
import { Toast, ToastRegion } from '../kit/alert/Toast';
import type { AlertQueue, AlertRequest } from './alerts';
import { useI18n } from './I18nProvider';

// AlertUtility's React binding (FU3, OQ-152): the provider draws the queue's
// shown toasts in the kit's toast region, and any component below it asks for
// a toast with `useAlerts()`. It sits inside the I18nProvider, which names the
// region and the close buttons.

/** What a toast may carry besides its message. */
export type AlertOptions = Pick<AlertRequest, 'action' | 'duration'>;

/** Shows a toast of one tone; returns its id, to close it early. */
export type ShowAlert = (message: string, options?: AlertOptions) => number;

/** The page's toasts, as components use them. */
export interface Alerts {
  readonly success: ShowAlert;
  readonly info: ShowAlert;
  readonly warning: ShowAlert;
  readonly error: ShowAlert;
  /** Closes a toast early, e.g. a "Saving…" note once the save ends. */
  readonly dismiss: (id: number) => void;
}

const AlertContext = createContext<Alerts | null>(null);

/** The provider's props. */
export interface AlertProviderProps {
  /** The page's toast queue, created in `main.tsx`. */
  readonly queue: AlertQueue;
  readonly children: ReactNode;
}

/**
 * Binds a queue to the tone-named calls components make.
 *
 * @param queue - The page's toast queue.
 * @returns The calls.
 */
export const alertsOf = (queue: AlertQueue): Alerts => {
  /**
   * Builds the call for one tone.
   *
   * @param tone - The tone its toasts take.
   * @returns The call.
   */
  const showAs = (tone: AlertTone): ShowAlert => (message, options) => (
    queue.show({ ...options, tone, message })
  );
  return {
    success: showAs('success'),
    info: showAs('info'),
    warning: showAs('warning'),
    error: showAs('error'),
    dismiss: queue.dismiss,
  };
};

/**
 * Makes the toast calls available below it and draws the shown toasts.
 *
 * @param props - The page's toast queue and the subtree.
 * @returns The subtree, followed by the toast region.
 */
export function AlertProvider({ queue, children }: AlertProviderProps) {
  const translator = useI18n();
  const visible = useSyncExternalStore(queue.subscribe, queue.visible);
  const alerts = useMemo(() => alertsOf(queue), [queue]);
  const dismissLabel = translator.text('alerts', 'dismiss');

  return (
    <AlertContext.Provider value={alerts}>
      {children}
      <ToastRegion label={translator.text('alerts', 'region')}>
        {visible.map((alert) => (
          <Toast
            key={alert.id}
            tone={alert.tone}
            message={alert.message}
            action={alert.action}
            duration={alert.duration}
            dismissLabel={dismissLabel}
            onDismiss={() => queue.dismiss(alert.id)}
          />
        ))}
      </ToastRegion>
    </AlertContext.Provider>
  );
}

/**
 * The page's toast calls.
 *
 * @returns The calls.
 * @throws {Error} Outside an `AlertProvider` — a wiring bug, not a runtime state.
 */
export const useAlerts = (): Alerts => {
  const alerts = useContext(AlertContext);
  if (alerts === null) {
    throw new Error('useAlerts must be used inside an AlertProvider');
  }
  return alerts;
};
