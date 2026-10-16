import { act, fireEvent, screen } from '@testing-library/react';
import {
  afterEach, beforeEach, describe, expect, it, vi,
} from 'vitest';
import { BackupCodesAcknowledgement } from '../../../../../../../src/experiences/onboard/flows/mfaEnrollment/interactions/BackupCodesAcknowledgement';
import { renderInLocale } from '../../../../../../support/renderInLocale';
import submitForm from '../../../../../../support/submitForm';

// Interaction (BDT: unit, display state in, events out): the real kit and
// translator render; only the Flow's handler and the browser's clipboard and
// object URLs (the external sinks) are stand-ins.

const CODES = ['4F9K-2QRT-8LMN-73WX', '1PZC-5VBH-6TGY-90KD', '3RQE-48FS-7HJX-21NA'];
const writeText = vi.fn(async (_text: string) => undefined);
const createObjectURL = vi.fn((_blob: Blob) => 'blob:codes');

beforeEach(() => {
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() });
});

afterEach(() => {
  vi.restoreAllMocks();
});

/**
 * Renders the step with a stand-in handler, in en-US.
 *
 * @returns The handler.
 */
const renderStep = () => {
  const onAcknowledge = vi.fn();
  renderInLocale(
    <BackupCodesAcknowledgement
      recoveryCodes={CODES}
      accountEmail="ana@example.com"
      onAcknowledge={onAcknowledge}
    />,
  );
  return onAcknowledge;
};

const continueButton = () => screen.getByRole<HTMLButtonElement>('button', { name: 'Continue' });

describe('BackupCodesAcknowledgement', () => {
  it('renders mockup 07 with every code issued, Continue off', () => {
    renderStep();

    expect(screen.getByRole('heading', { level: 1, name: 'Save your backup codes' }))
      .toBeTruthy();
    const list = screen.getByRole('list', { name: 'Backup codes' });
    expect([...list.querySelectorAll('li')].map((item) => item.textContent)).toEqual(CODES);
    expect(continueButton().disabled).toBe(true);
  });

  it('downloads the codes under a line naming the account', async () => {
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    renderStep();

    fireEvent.click(screen.getByRole('button', { name: 'Download' }));

    const blob = createObjectURL.mock.calls[0]![0];
    expect(await blob.text()).toBe(
      `Backup codes for ana@example.com — each works once.\n\n${CODES.join('\n')}\n`,
    );
  });

  it('copies every code, one per line, and says so', async () => {
    renderStep();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy all' }));
    });

    expect(writeText).toHaveBeenCalledWith(CODES.join('\n'));
    expect(screen.getByRole('button', { name: 'Copied' })).toBeTruthy();
  });

  it('acknowledges only once the codes are ticked as saved', () => {
    const onAcknowledge = renderStep();

    submitForm(continueButton());
    expect(onAcknowledge).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('checkbox', { name: /saved these codes/ }));
    expect(continueButton().disabled).toBe(false);
    fireEvent.click(continueButton());
    expect(onAcknowledge).toHaveBeenCalledTimes(1);
  });
});
