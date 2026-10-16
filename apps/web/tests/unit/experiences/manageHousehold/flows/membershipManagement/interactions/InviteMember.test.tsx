import { fireEvent, screen } from '@testing-library/react';
import {
  describe, expect, it, vi,
} from 'vitest';
import {
  InviteMember, type InviteMemberProps,
} from '../../../../../../../src/experiences/manageHousehold/flows/membershipManagement/interactions/InviteMember';
import { renderInLocale } from '../../../../../../support/renderInLocale';
import submitForm from '../../../../../../support/submitForm';

// Interaction (BDT: unit, display state in, events out): the real kit,
// translator and ValidationUtility; only the Flow's handler is a stand-in.

/**
 * Renders the form with a stand-in handler, in en-US.
 *
 * @param props - The props to set or override.
 * @returns The handler.
 */
const renderForm = (props: Partial<InviteMemberProps> = {}) => {
  const onSubmit = vi.fn();
  renderInLocale(<InviteMember busy={false} disabled={false} onSubmit={onSubmit} {...props} />);
  return onSubmit;
};

const sendButton = () => screen.getByRole<HTMLButtonElement>('button', { name: 'Send invite' });
const emailField = () => screen.getByLabelText('Email');
const send = () => fireEvent.click(screen.getByRole('button', { name: 'Send invite' }));

describe('InviteMember', () => {
  it('sends the trimmed email with Member unless another role is picked', () => {
    const onSubmit = renderForm();
    expect(screen.getByText('They need an account already — invites go to registered users only.'))
      .toBeTruthy();

    fireEvent.change(emailField(), { target: { value: '  morgan@example.com ' } });
    send();
    expect(onSubmit).toHaveBeenLastCalledWith({ email: 'morgan@example.com', role: 'Member' });

    fireEvent.click(screen.getByRole('radio', { name: 'Viewer' }));
    send();
    expect(onSubmit).toHaveBeenLastCalledWith({ email: 'morgan@example.com', role: 'Viewer' });
  });

  it('refuses a blank or malformed email, and drops the error on typing', () => {
    const onSubmit = renderForm();
    send();
    expect(screen.getByText('Required.')).toBeTruthy();

    fireEvent.change(emailField(), { target: { value: 'nope' } });
    expect(screen.queryByText('Required.')).toBeNull();
    send();
    expect(screen.getByText('Enter a valid email.')).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("shows the server's objection under the field and anything else in the banner", () => {
    renderForm({ emailError: 'No registered user has this email.', alert: 'Something failed' });
    expect(screen.getByText('No registered user has this email.')).toBeTruthy();
    expect(screen.getByText('Something failed')).toBeTruthy();
  });

  it('ignores a submit while an invite or another request is out', () => {
    const busy = renderForm({ busy: true });
    fireEvent.change(emailField(), { target: { value: 'morgan@example.com' } });
    submitForm(emailField());
    expect(busy).not.toHaveBeenCalled();
  });

  it('waits, without spinning, while another request is out', () => {
    const onSubmit = renderForm({ disabled: true });
    expect(sendButton().disabled).toBe(true);
    fireEvent.change(emailField(), { target: { value: 'morgan@example.com' } });
    submitForm(emailField());
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
