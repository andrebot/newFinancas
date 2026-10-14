import type { Meta, StoryObj } from '@storybook/react-vite';

// The type roles of styles/typography.css (K2, OQ-125): Manrope for display,
// Inter for the rest. Edit the sample text in the controls panel.

const ROLES = [
  'type-display-xl', 'type-display-lg', 'type-display-md', 'type-display-sm', 'type-display-xs',
  'type-heading-lg', 'type-heading-md', 'type-heading-sm',
  'type-body-lg', 'type-body', 'type-body-sm', 'type-caption', 'type-label', 'type-micro',
] as const;

/** The specimen's props. */
interface TypeSpecimenProps {
  /** The text each role sets. */
  readonly sample: string;
}

/**
 * Renders the sample once per type role, labelled with the role's utility.
 *
 * @param props - The sample text.
 * @returns The specimen.
 */
function TypeSpecimen({ sample }: TypeSpecimenProps) {
  return (
    <dl className="grid gap-5">
      {ROLES.map((role) => (
        <div key={role} className="grid gap-1">
          <dt className="font-mono type-caption text-muted">{role}</dt>
          <dd className={role}>{sample}</dd>
        </div>
      ))}
    </dl>
  );
}

const meta = {
  title: 'Foundations/Typography',
  component: TypeSpecimen,
} satisfies Meta<typeof TypeSpecimen>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Every role, with an amount and accented text to check the glyphs. */
export const Roles: Story = {
  args: { sample: 'Orçamento de março — R$ 12.345,67' },
};
