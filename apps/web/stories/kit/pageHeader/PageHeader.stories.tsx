import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { Avatar } from '../../../src/kit/avatar/Avatar';
import { Button } from '../../../src/kit/button/Button';
import { PageHeader, type PageHeaderProps } from '../../../src/kit/pageHeader/PageHeader';
import { SegmentedControl } from '../../../src/kit/segmentedControl/SegmentedControl';

// The kit's page header (K34, OQ-135), as the App Shell pages draw it:
// Account Setup with its action and tabs (40), Household's summary (60) and
// the profile's avatar (70). The buttons stand in for K4.

const meta = {
  title: 'Kit/PageHeader',
  component: PageHeader,
  args: {
    title: 'Investments',
    description: 'Net worth across every holding, sliced a few ways.',
  },
} satisfies Meta<PageHeaderProps>;

export default meta;

type Story = StoryObj<typeof meta>;

type Section = 'accounts' | 'categories' | 'budgets' | 'goals';

/**
 * Account Setup's tabs, kept selected as they would be by the route.
 *
 * @returns The segmented control.
 */
function SetupTabs() {
  const [section, setSection] = useState<Section>('accounts');
  return (
    <SegmentedControl
      label="Account Setup sections"
      value={section}
      onChange={setSection}
      options={[
        { value: 'accounts', label: 'Accounts', icon: 'account-balance-wallet-outline' },
        { value: 'categories', label: 'Categories', icon: 'category-outline' },
        { value: 'budgets', label: 'Budgets', icon: 'donut-large' },
        { value: 'goals', label: 'Goals', icon: 'flag-outline' },
      ]}
    />
  );
}

/** A title and description. */
export const Basic: Story = {};

/** Account Setup: the eyebrow, an action and the tabs. */
export const WithTabs: Story = {
  args: {
    eyebrow: 'Account Setup',
    title: 'Accounts',
    description: 'Your checking, savings and credit card accounts, and their cards.',
    actions: (
      <Button variant="primary" size="lg" leadingIcon="add">Add Account</Button>
    ),
    tabs: <SetupTabs />,
  },
};

/** The profile: the large avatar before the title. */
export const Leading: Story = {
  args: {
    eyebrow: 'Profile',
    title: 'Jane Doe',
    description: 'jane.doe@example.com · Owner of The Doe Household',
    leading: <Avatar firstName="Jane" lastName="Doe" tone="mint" size="lg" />,
  },
};
