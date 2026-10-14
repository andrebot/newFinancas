import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  Avatar, avatarTone, type AvatarProps,
} from '../../../src/kit/avatar/Avatar';

// The kit's avatar (K31, OQ-134), as the mockups draw it: the household
// members list (60), the nav drawer (21) and the profile header (70).

const meta = {
  title: 'Kit/Avatar',
  component: Avatar,
  args: { firstName: 'Jane', lastName: 'Doe', tone: 'mint' },
  argTypes: {
    tone: { control: 'inline-radio', options: ['mint', 'sky', 'sun', 'lilac'] },
    size: { control: 'inline-radio', options: ['md', 'lg'] },
  },
} satisfies Meta<AvatarProps>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The signed-in user, as in the nav drawer. */
export const Self: Story = {};

/** The profile header's large avatar. */
export const Large: Story = { args: { size: 'lg' } };

/** A household's members, each coloured by `avatarTone` from their id. */
export const Members: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      <Avatar firstName="Jane" lastName="Doe" tone={avatarTone('u-jane', true)} />
      <Avatar firstName="Alex" lastName="Rivera" tone={avatarTone('u-alex', false)} />
      <Avatar firstName="Sam" lastName="Costa" tone={avatarTone('u-sam', false)} />
      <Avatar firstName="Priya" lastName="Shah" tone={avatarTone('u-priya', false)} />
      <Avatar firstName="Élodie" lastName="Ñúñez" tone={avatarTone('u-elodie', false)} />
    </div>
  ),
};
