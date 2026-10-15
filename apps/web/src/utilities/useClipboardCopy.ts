import { useEffect, useRef, useState } from 'react';
import { createLogger } from '@financas/logging/browser';
import { clipboard } from '../config/constants';

// ClipboardUtility (OQ-149): copies text for a copy button and says, for a
// moment, that it worked — no journey knowledge. A refused copy (no
// permission, insecure page) is logged and shows no "Copied".

const log = createLogger({ label: 'ClipboardUtility' });

/** What a copy button needs: whether the last copy just worked, and the copy. */
export interface ClipboardCopy {
  readonly copied: boolean;
  readonly copy: (text: string) => Promise<void>;
}

/**
 * Copies text to the clipboard, with a short-lived `copied` flag.
 *
 * @returns The flag and the copy action.
 */
export default function useClipboardCopy(): ClipboardCopy {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  /**
   * Writes the text and shows "Copied" for a moment.
   *
   * @param text - What to copy.
   */
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      log.warn('Copy to the clipboard refused', { error: String(error) });
      return;
    }
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), clipboard.copiedFeedbackMs);
  };

  return { copied, copy };
}
