import {
  useEffect, useRef, useState, type FormEvent, type RefObject,
} from 'react';
import useToday from '../../utilities/useToday';
import {
  draftErrorsOf, isDraftValid, type HistoryDraft, type HistoryDraftErrors, type HistoryEntry,
  type HistoryOutcome, type HistorySubmission, type HistoryValueKind,
} from './historyModel';

// The History editor's state (K46, OQ-232): which value is open — edited,
// being deleted, or a new one — what is typed, whether the caller's request
// runs, and where focus goes back to. The caller runs the request; its
// answer closes the form (`done`) or keeps it (`refused`). A value saved or
// deleted stays dimmed, as loading, until the caller's list changes.

/** What is open: one value's form or its delete confirm, the new value's form, or nothing. */
export type HistoryOpen = { readonly mode: 'edit'; readonly key: string }
  | { readonly mode: 'delete'; readonly key: string }
  | { readonly mode: 'add' }
  | null;

/** Where focus goes when what is open closes. */
interface FocusReturn {
  /**
   * What held focus when it opened, e.g. the plot; never the page itself,
   * which is what a click on a button leaves focused in Safari.
   */
  readonly element: HTMLElement | null;
  /** The id of the button that opened it, which may have been drawn anew. */
  readonly fallbackId: string;
}

/** A value whose save or delete went through, until the list it was in is replaced. */
export interface HistorySettling {
  readonly key: string;
  /** The list when the request went through; a refetch hands down a new one. */
  readonly entries: readonly HistoryEntry[];
}

/** What the editor's state is built from. */
export interface HistoryEditingInput {
  readonly entries: readonly HistoryEntry[];
  readonly valueKind: HistoryValueKind;
  readonly uniqueDays: boolean;
  readonly onSave: (submission: HistorySubmission) => Promise<HistoryOutcome>;
  readonly onDelete: (key: string) => Promise<HistoryOutcome>;
  /** The list, focused when nothing better is left to go back to. */
  readonly listRef: RefObject<HTMLElement | null>;
}

/** The editor's state and what changes it. */
export interface HistoryEditing {
  /** What is open, or `null`; a value that left the list closes. */
  readonly open: HistoryOpen;
  /** The value shown as loading: saved or deleted, the list not yet refetched. */
  readonly settlingKey: string | undefined;
  readonly draft: HistoryDraft;
  readonly busy: boolean;
  /** The draft's problems, shown once a save was refused. */
  readonly errors: HistoryDraftErrors;
  /** Counts refused saves, so each one moves focus to the first problem. */
  readonly refusals: number;
  readonly setDraft: (draft: HistoryDraft) => void;
  /** Opens a value's form, or the new value's form without a key; the open one stays as typed. */
  readonly startEdit: (fallbackId: string, key?: string) => void;
  readonly startDelete: (fallbackId: string, key: string) => void;
  /** Closes what is open; its buttons and Escape do nothing while a request runs. */
  readonly cancel: () => void;
  /** Saves the draft, or counts a refusal when it has problems; nothing while a request runs. */
  readonly submit: (event: FormEvent) => void;
  /** Deletes a value; its confirm's button does nothing while the request runs. */
  readonly confirmDelete: (key: string) => void;
}

const EMPTY_DRAFT: HistoryDraft = { date: '', value: null };

/** Sends focus to the list: nothing to go back to, or nothing that can take it yet. */
const TO_LIST: FocusReturn = { element: null, fallbackId: '' };

/**
 * Asks the caller, reading a failed promise as a refusal so the form stays.
 *
 * @param request - The caller's request.
 * @returns How it ended.
 */
export const outcomeOf = async (
  request: () => Promise<HistoryOutcome>,
): Promise<HistoryOutcome> => {
  try {
    return await request();
  } catch {
    return 'refused';
  }
};

/**
 * Drops what is open once its value left the list, e.g. after a refetch.
 *
 * @param open - What is open.
 * @param entries - The saved values.
 * @returns What is still open.
 */
export const openStillListed = (
  open: HistoryOpen,
  entries: readonly HistoryEntry[],
): HistoryOpen => {
  if (open === null || open.mode === 'add') return open;
  return entries.some((entry) => entry.key === open.key) ? open : null;
};

/**
 * Names the value still shown as loading: one saved or deleted while the
 * caller's list is still the one it was in. Any new list ends it, so a
 * refetch that fails doesn't leave it dimmed for good.
 *
 * @param settling - The value whose request went through, if any.
 * @param entries - The saved values now.
 * @returns Its key, or none once the list was replaced.
 */
export const settlingKeyOf = (
  settling: HistorySettling | null,
  entries: readonly HistoryEntry[],
): string | undefined => (
  settling?.entries === entries ? settling.key : undefined
);

/**
 * Names the value whose form is open.
 *
 * @param open - What is open.
 * @returns Its key, or none when no value is edited.
 */
export const editingKeyOf = (open: HistoryOpen): string | undefined => (
  open?.mode === 'edit' ? open.key : undefined
);

/**
 * Sends focus back where it was, a frame later, once what was open is gone:
 * the element that held it, else the button that opened it, else the list.
 *
 * @param target - Where focus came from.
 * @param listRef - The list, the last resort.
 */
const restoreFocus = (target: FocusReturn, listRef: RefObject<HTMLElement | null>) => {
  requestAnimationFrame(() => {
    const element = target.element?.isConnected ? target.element : null;
    (element ?? document.getElementById(target.fallbackId) ?? listRef.current)?.focus();
  });
};

/**
 * Holds the History editor's state.
 *
 * @param input - The values, their kind, the caller's requests and the list.
 * @returns The state and its actions.
 */
export default function useHistoryEditing({
  entries, valueKind, uniqueDays, onSave, onDelete, listRef,
}: HistoryEditingInput): HistoryEditing {
  const today = useToday();
  const [openState, setOpen] = useState<HistoryOpen>(null);
  const [draft, setDraft] = useState<HistoryDraft>(EMPTY_DRAFT);
  const [busy, setBusy] = useState(false);
  const [refusals, setRefusals] = useState(0);
  const [settling, setSettling] = useState<HistorySettling | null>(null);
  const focusReturn = useRef<FocusReturn>(TO_LIST);
  const open = openStillListed(openState, entries);
  const editingKey = editingKeyOf(open);
  const errors = draftErrorsOf(draft, {
    today, valueKind, entries, editingKey, uniqueDays,
  });

  useEffect(() => {
    if (openState !== null && open === null) restoreFocus(focusReturn.current, listRef);
  }, [openState, open, listRef]);

  /**
   * Opens something, keeping where focus came from.
   *
   * @param next - What to open.
   * @param fallbackId - The id of the button that opened it.
   * @param nextDraft - The draft to start from.
   */
  const openWith = (next: HistoryOpen, fallbackId: string, nextDraft: HistoryDraft) => {
    if (busy) return;
    const active = document.activeElement;
    const held = active instanceof HTMLElement && active !== document.body ? active : null;
    focusReturn.current = { element: held, fallbackId };
    setOpen(next);
    setDraft(nextDraft);
    setRefusals(0);
  };

  /**
   * Closes what is open and sends focus back.
   *
   * @param target - Where focus goes; where it came from by default.
   */
  const close = (target: FocusReturn = focusReturn.current) => {
    setOpen(null);
    restoreFocus(target, listRef);
  };

  /**
   * Runs the caller's request. Once it is done, what is open closes. A new
   * value sends focus back to Add; a saved or deleted one stays dimmed until
   * the list changes, and focus goes to the list, since its buttons wait.
   *
   * @param request - The caller's request.
   * @param key - The value it is about; none for a new one.
   */
  const run = async (request: () => Promise<HistoryOutcome>, key?: string) => {
    setBusy(true);
    const outcome = await outcomeOf(request);
    setBusy(false);
    if (outcome !== 'done') return;
    if (key === undefined) {
      close();
      return;
    }
    setSettling({ key, entries });
    close(TO_LIST);
  };

  const startEdit = (fallbackId: string, key?: string) => {
    if (key !== undefined && key === editingKey) return;
    const entry = entries.find((candidate) => candidate.key === key);
    if (entry) openWith({ mode: 'edit', key: entry.key }, fallbackId, entry);
    else openWith({ mode: 'add' }, fallbackId, EMPTY_DRAFT);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    if (!isDraftValid(errors) || draft.value === null) {
      setRefusals((count) => count + 1);
      return;
    }
    const submission = { key: editingKey, date: draft.date, value: draft.value };
    run(() => onSave(submission), editingKey);
  };

  const startDelete = (fallbackId: string, key: string) => {
    openWith({ mode: 'delete', key }, fallbackId, EMPTY_DRAFT);
  };

  const confirmDelete = (key: string) => {
    run(() => onDelete(key), key);
  };

  return {
    open,
    settlingKey: settlingKeyOf(settling, entries),
    draft,
    busy,
    errors: refusals > 0 ? errors : {},
    refusals,
    setDraft,
    startEdit,
    startDelete,
    cancel: () => close(),
    submit,
    confirmDelete,
  };
}
