import type { Meta, StoryObj } from '@storybook/react-vite';
import { useEffect, useState } from 'react';
import { fn } from 'storybook/test';
import {
  PasswordField, type PasswordFieldProps,
} from '../../../src/kit/passwordField/PasswordField';
import { createTranslator } from '../../../src/utilities/i18n';
import {
  loadPasswordStrengthEstimator,
  strengthCaption,
  type PasswordStrength,
  type PasswordStrengthEstimator,
} from '../../../src/utilities/passwordStrength';

// The kit's password field (K6, OQ-144). It holds only whether the password
// shows, so each story keeps the text itself; `onChange` also shows in the
// actions panel. Every meter runs the real estimator on each keystroke and
// words its caption as the screens will, with `strengthCaption`.

const english = createTranslator('en-US');

/**
 * Builds the meter's props for a reading, captioned in English.
 *
 * @param reading - The meter's reading.
 * @returns The reading with its caption.
 */
const meterFor = (reading: PasswordStrength) => ({
  reading,
  caption: strengthCaption(reading, english),
});

/**
 * Renders the password field with its text kept locally, starting from the
 * `value` arg, so typing edits it.
 *
 * @param props - The story's args: the starting text, the change handler and the rest.
 * @returns The interactive password field.
 */
function Interactive({ value: initial, onChange, ...rest }: PasswordFieldProps) {
  const [value, setValue] = useState(initial);
  return (
    <PasswordField
      {...rest}
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
    />
  );
}

/**
 * Renders the password field with the real estimator rating each keystroke,
 * as Create account will; no meter shows until the estimator has loaded.
 *
 * @param props - The story's args.
 * @returns The password field with a live meter.
 */
function WithLiveMeter({ value: initial, onChange, ...rest }: PasswordFieldProps) {
  const [value, setValue] = useState(initial);
  const [estimate, setEstimate] = useState<PasswordStrengthEstimator>();

  useEffect(() => {
    loadPasswordStrengthEstimator().then((estimator) => setEstimate(() => estimator));
  }, []);

  return (
    <PasswordField
      {...rest}
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
      strength={estimate && meterFor(estimate(value, ['Jane Doe', 'jane.doe@example.com']))}
    />
  );
}

/**
 * A sample password per meter level, checked against the estimator: too
 * short, weak, fair, good, strong.
 */
const SAMPLES = [
  'river42lamp',
  'password1234',
  'blueberrycake',
  'mapleriverstone',
  'purple-monkey-dish',
] as const;

const meta = {
  title: 'Kit/PasswordField',
  component: PasswordField,
  render: (args) => <Interactive key={args.value} {...args} />,
  decorators: [(Story) => <div className="max-w-sm"><Story /></div>],
  args: {
    label: 'Password',
    value: 'correct horse battery',
    revealLabel: 'Show password',
    autoComplete: 'current-password',
    onChange: fn(),
  },
} satisfies Meta<PasswordFieldProps>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Sign in: masked, with the eye button and "Forgot password?" beside the label. */
export const SignIn: Story = {
  args: {
    labelAction: <a href="#forgot" className="text-mint hover:underline">Forgot password?</a>,
  },
};

/**
 * Create account: the real estimator rates each keystroke. Try
 * `river42lamp`, `password1234`, `blueberrycake`, `mapleriverstone` and
 * `purple-monkey-dish` for too short through strong.
 */
export const LiveMeter: Story = {
  args: { autoComplete: 'new-password', value: '' },
  render: (args) => <WithLiveMeter {...args} />,
};

/** Every meter level, as Create account, Reset and Change password show it; each one is live. */
export const MeterLevels: Story = {
  args: { autoComplete: 'new-password', label: 'New password' },
  render: (args) => (
    <div className="flex flex-col gap-5">
      {SAMPLES.map((sample) => <WithLiveMeter key={sample} {...args} value={sample} />)}
    </div>
  ),
};

/** Invalid: the error sits under the meter. */
export const Invalid: Story = {
  args: {
    label: 'New password',
    autoComplete: 'new-password',
    value: 'short',
    error: 'Use at least 12 characters.',
  },
  render: (args) => <WithLiveMeter {...args} />,
};

/** Disabled: the eye button too. */
export const Disabled: Story = { args: { disabled: true } };
