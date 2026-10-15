import type { AlertTone } from '../kit/alert/tones';
import type { ToastAction } from '../kit/alert/Toast';

// AlertUtility (FU3, OQ-152): the page's toast queue. Any tier asks for a toast
// with an already translated message; the queue decides which ones show. At most
// `cap` are on screen, oldest first; the rest wait in order and slide in as the
// shown ones close, so a sticky error is never pushed out unread. A toast with
// the same tone and message as one shown or waiting is not added again. Inline
// banners are not queued: the Flow that owns the state draws the kit's banner.

/** What a caller asks to show. */
export interface AlertRequest {
  readonly tone: AlertTone;
  /** What happened, already translated. */
  readonly message: string;
  readonly action?: ToastAction | undefined;
  /** In ms; `null` keeps it until closed. Defaults by tone (the kit's rule). */
  readonly duration?: number | null | undefined;
}

/** A queued toast. */
export interface Alert extends AlertRequest {
  readonly id: number;
}

/** The page's toasts, shown and waiting. */
export interface AlertQueue {
  /** Calls `listener` whenever the shown toasts change; returns the unsubscribe. */
  readonly subscribe: (listener: () => void) => () => void;
  /** The toasts on screen, oldest first; the same array until they change. */
  readonly visible: () => readonly Alert[];
  /** Queues a toast; a duplicate of a queued one is not added. Returns its id. */
  readonly show: (request: AlertRequest) => number;
  /** Closes a toast, shown or waiting; an unknown id does nothing. */
  readonly dismiss: (id: number) => void;
}

/**
 * Finds a queued toast that says the same thing.
 *
 * @param alerts - Every queued toast, shown and waiting.
 * @param request - The toast being asked for.
 * @returns The match, or `undefined` when there is none.
 */
export const findDuplicate = (
  alerts: readonly Alert[],
  request: AlertRequest,
): Alert | undefined => alerts.find((alert) => (
  alert.tone === request.tone && alert.message === request.message
));

/**
 * Creates an empty toast queue.
 *
 * @param cap - How many toasts show at once (`toast.maxVisible`).
 * @returns The queue.
 */
export const createAlertQueue = (cap: number): AlertQueue => {
  const listeners = new Set<() => void>();
  let alerts: readonly Alert[] = [];
  let visible: readonly Alert[] = [];
  let nextId = 1;

  /**
   * Stores the new queue and, when the shown toasts changed, tells listeners.
   *
   * @param next - Every queued toast, oldest first.
   */
  const update = (next: readonly Alert[]) => {
    alerts = next;
    const shown = next.slice(0, cap);
    const changed = shown.length !== visible.length
      || shown.some((alert, index) => alert !== visible[index]);
    if (!changed) return;
    visible = shown;
    listeners.forEach((listener) => listener());
  };

  return {
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    visible: () => visible,
    show: (request) => {
      const duplicate = findDuplicate(alerts, request);
      if (duplicate) return duplicate.id;
      const alert: Alert = { ...request, id: nextId };
      nextId += 1;
      update([...alerts, alert]);
      return alert.id;
    },
    dismiss: (id) => {
      if (!alerts.some((alert) => alert.id === id)) return;
      update(alerts.filter((alert) => alert.id !== id));
    },
  };
};
