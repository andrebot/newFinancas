import { useSyncExternalStore } from 'react';

// Whether a dialog the App Shell's chrome opens is open (task 139, OQ-243):
// the drawer's "Export audit log" calls `open` — a plain handler from the
// shell's configuration — and the dialog, mounted in the chrome's overlays,
// reads the switch. A tiny store of one flag, so no Redux slice is needed for
// a dialog that holds no data.

/** One dialog's open flag. */
export interface DialogSwitch {
  readonly open: () => void;
  readonly close: () => void;
  readonly isOpen: () => boolean;
  /** Calls the listener whenever the flag changes; returns its removal. */
  readonly subscribe: (listener: () => void) => () => void;
}

/**
 * Creates a dialog's switch, closed.
 *
 * @returns The switch.
 */
export const createDialogSwitch = (): DialogSwitch => {
  let opened = false;
  const listeners = new Set<() => void>();
  const set = (next: boolean) => {
    if (next === opened) return;
    opened = next;
    listeners.forEach((listener) => listener());
  };
  return {
    open: () => set(true),
    close: () => set(false),
    isOpen: () => opened,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
};

/**
 * Reads a dialog's switch, re-rendering when it flips.
 *
 * @param dialog - The switch.
 * @returns Whether the dialog is open.
 */
export const useDialogOpen = (dialog: DialogSwitch): boolean => (
  useSyncExternalStore(dialog.subscribe, dialog.isOpen)
);
