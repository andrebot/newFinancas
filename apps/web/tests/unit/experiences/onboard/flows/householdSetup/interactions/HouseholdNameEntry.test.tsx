import { fireEvent, screen } from '@testing-library/react';
import {
  describe, expect, it, vi,
} from 'vitest';
import {
  HouseholdNameEntry, type HouseholdNameEntryProps,
} from '../../../../../../../src/experiences/onboard/flows/householdSetup/interactions/HouseholdNameEntry';
import { renderInLocale } from '../../../../../../support/renderInLocale';

// Interaction (BDT: unit, display state in, events out): the real kit and
// translator; only the Flow's handlers are stand-ins.

/**
 * Renders the entry with a stand-in submit handler, in en-US.
 *
 * @param props - The props to set or override.
 * @returns The handler.
 */
const renderEntry = (props: Partial<HouseholdNameEntryProps> = {}) => {
  const onSubmit = vi.fn();
  renderInLocale(<HouseholdNameEntry busy={false} onSubmit={onSubmit} {...props} />);
  return { onSubmit };
};

const nameInput = () => screen.getByLabelText<HTMLInputElement>('Household name');
const continueButton = () => screen.getByRole('button', { name: 'Continue' });

/**
 * Types a name.
 *
 * @param value - What to type.
 */
const typeName = (value: string) => {
  fireEvent.change(nameInput(), { target: { value } });
};

describe('HouseholdNameEntry', () => {
  it("renders mockup 10's heading and an empty name field, focused", () => {
    renderEntry();

    expect(screen.getByRole('heading', { level: 1, name: 'Name your household' })).toBeTruthy();
    expect(screen.getByText(/This is what everyone you invite will see/)).toBeTruthy();
    expect(nameInput().value).toBe('');
    expect(document.activeElement).toBe(nameInput());
  });

  it('has no "Ideas" chips (OQ-150)', () => {
    renderEntry();

    expect(screen.getAllByRole('button')).toEqual([continueButton()]);
  });

  it('emits the name trimmed', () => {
    const { onSubmit } = renderEntry();
    typeName('  Casa da Praia ');

    fireEvent.click(continueButton());

    expect(onSubmit).toHaveBeenCalledWith('Casa da Praia');
  });

  it('refuses a blank name and drops the error once typing resumes', () => {
    const { onSubmit } = renderEntry();
    typeName('   ');

    fireEvent.click(continueButton());

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Required.')).toBeTruthy();

    typeName('Apt 4B');
    expect(screen.queryByText('Required.')).toBeNull();
  });

  it('ignores submits while a request is out', () => {
    const { onSubmit } = renderEntry({ busy: true });
    typeName('Casa da Praia');

    fireEvent.submit(nameInput().form as HTMLFormElement);

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('shows the last failure in the banner', () => {
    renderEntry({ alert: 'Something went wrong.' });

    expect(screen.getByRole('alert').textContent).toContain('Something went wrong.');
  });

  it('shows Cancel only when given a way out, and emits it', () => {
    const onCancel = vi.fn();
    renderEntry({ onCancel });

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('renders in pt-BR', () => {
    renderInLocale(<HouseholdNameEntry busy={false} onSubmit={vi.fn()} />, 'pt-BR');

    expect(screen.getByLabelText('Nome da casa')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeTruthy();
  });
});
