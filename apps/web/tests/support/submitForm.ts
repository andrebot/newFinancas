import { fireEvent } from '@testing-library/react';
import { expect } from 'vitest';

// jsdom never navigates, so a form that forgets `event.preventDefault()` looks
// fine in a test while a real browser reloads the page on submit. Submitting
// through this helper checks the default was prevented.

/**
 * Submits a form the way the browser does, and checks the page itself was
 * not submitted (the form's handler prevented the default).
 *
 * @param target - The form, or an element inside it.
 */
const submitForm = (target: Element): void => {
  const form = target instanceof HTMLFormElement ? target : target.closest('form');
  expect(form, 'the element is not inside a form').not.toBeNull();
  expect(fireEvent.submit(form!), 'the form let the page submit').toBe(false);
};

export default submitForm;
