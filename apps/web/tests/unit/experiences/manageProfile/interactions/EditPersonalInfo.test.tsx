import { fireEvent, screen } from '@testing-library/react';
import {
  describe, expect, it, vi,
} from 'vitest';
import {
  EditPersonalInfo, isChanged, trimmed, type EditPersonalInfoProps,
} from '../../../../../src/experiences/manageProfile/interactions/EditPersonalInfo';
import { renderInLocale } from '../../../../support/renderInLocale';
import submitForm from '../../../../support/submitForm';

// Interaction (BDT: unit, display state in, events out): the real kit and
// translator; only the Experience's handler is a stand-in.

const SAVED = { firstName: 'Jane', lastName: 'Doe' };

/**
 * Renders the panel with a stand-in handler, in a locale.
 *
 * @param props - The props to set or override.
 * @param locale - The locale; en-US by default.
 * @returns The handler.
 */
const renderPanel = (
  props: Partial<EditPersonalInfoProps> = {},
  locale: 'en-US' | 'pt-BR' = 'en-US',
) => {
  const onSave = vi.fn();
  renderInLocale(
    <EditPersonalInfo
      saved={SAVED}
      email="jane.doe@example.com"
      busy={false}
      onSave={onSave}
      {...props}
    />,
    locale,
  );
  return onSave;
};

const firstInput = () => screen.getByLabelText<HTMLInputElement>('First name');
const lastInput = () => screen.getByLabelText<HTMLInputElement>('Last name');
const saveButton = () => screen.getByRole<HTMLButtonElement>('button', { name: 'Save' });

describe('trimmed / isChanged', () => {
  it('trims both names', () => {
    expect(trimmed({ firstName: ' Jo ', lastName: '\tDoe ' })).toEqual({
      firstName: 'Jo', lastName: 'Doe',
    });
  });

  it('compares what is typed, trimmed, with what is saved', () => {
    expect(isChanged({ firstName: ' Jane ', lastName: 'Doe' }, SAVED)).toBe(false);
    expect(isChanged({ firstName: 'Janet', lastName: 'Doe' }, SAVED)).toBe(true);
    expect(isChanged({ firstName: 'Jane', lastName: 'Do' }, SAVED)).toBe(true);
  });
});

describe('EditPersonalInfo', () => {
  it("renders mockup 70's panel: the saved names, the locked email and its note", () => {
    renderPanel();

    expect(screen.getByRole('heading', { level: 2, name: 'Personal info' })).toBeTruthy();
    expect(firstInput().value).toBe('Jane');
    expect(firstInput().autocomplete).toBe('given-name');
    expect(lastInput().value).toBe('Doe');
    expect(lastInput().autocomplete).toBe('family-name');
    expect(screen.getByText('jane.doe@example.com')).toBeTruthy();
    expect(screen.getByText('Email and password each have their own dedicated flow.')).toBeTruthy();
  });

  it('waits to save until a name differs from the saved one', () => {
    renderPanel();
    expect(saveButton().disabled).toBe(true);

    fireEvent.change(firstInput(), { target: { value: 'Janet' } });

    expect(saveButton().disabled).toBe(false);
  });

  it('emits both names trimmed', () => {
    const onSave = renderPanel();
    fireEvent.change(firstInput(), { target: { value: '  Janet ' } });

    fireEvent.click(saveButton());

    expect(onSave).toHaveBeenCalledWith({ firstName: 'Janet', lastName: 'Doe' });
  });

  it('flags a blank name, emitting nothing, and clears the flag on typing', () => {
    const onSave = renderPanel();
    fireEvent.change(lastInput(), { target: { value: '   ' } });

    fireEvent.click(saveButton());

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText('Required.')).toBeTruthy();
    fireEvent.change(lastInput(), { target: { value: 'Smith' } });
    expect(screen.queryByText('Required.')).toBeNull();
  });

  it('ignores a submit while the save is out, and spins', () => {
    const onSave = renderPanel({ busy: true });
    fireEvent.change(firstInput(), { target: { value: 'Janet' } });

    submitForm(saveButton());

    expect(onSave).not.toHaveBeenCalled();
    expect(saveButton().getAttribute('aria-busy')).toBe('true');
  });

  it('shows the failure in a banner', () => {
    renderPanel({ alert: 'Something went wrong. Please try again.' });

    expect(screen.getByRole('alert').textContent).toContain('Something went wrong.');
  });

  it('reads every text from the catalog (pt-BR)', () => {
    renderPanel({}, 'pt-BR');

    expect(screen.getByRole('heading', { name: 'Dados pessoais' })).toBeTruthy();
    expect(screen.getByLabelText('Nome')).toBeTruthy();
    expect(screen.getByLabelText('Sobrenome')).toBeTruthy();
    expect(screen.getByText('E-mail')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeTruthy();
  });
});
