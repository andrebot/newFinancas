import { composeStories, setProjectAnnotations, type Meta } from '@storybook/react-vite';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentType } from 'react';
import {
  beforeAll, describe, expect, it,
} from 'vitest';
import preview from '../../../.storybook/preview';
import * as iconStories from '../../../stories/kit/icons/Icon.stories';
import * as segmentedStories from '../../../stories/kit/segmentedControl/SegmentedControl.stories';

// Smoke test for the component library (N14, OQ-128): every story renders
// through the real preview (StoryFrame's theme and locale) without throwing.
// It catches a story broken by a kit change that still typechecks. The two
// story-only behaviours (icon search, the selection kept by a controlled
// story) get one check each.

type StoryModule = { default: Meta } & Record<string, unknown>;

const modules = import.meta.glob<StoryModule>('../../../stories/**/*.stories.tsx', {
  eager: true,
});

const cases = Object.entries(modules).flatMap(([path, module]) => (
  Object.entries(composeStories(module)).map(([name, Story]) => ({
    title: `${path.replace('../../../stories/', '')} › ${name}`,
    Story: Story as ComponentType,
  }))
));

beforeAll(() => {
  setProjectAnnotations(preview);
});

describe('stories', () => {
  it('finds the stories', () => {
    expect(cases.length).toBeGreaterThan(0);
  });

  it.each(cases)('renders $title', ({ Story }) => {
    const { container } = render(<Story />);

    // The container holds StoryFrame, which holds the story's output.
    expect(container.firstElementChild?.childElementCount).toBeGreaterThan(0);
  });

  it('applies the toolbar theme and locale to <html>', () => {
    const { Medium } = composeStories(segmentedStories, {
      initialGlobals: { theme: 'light', locale: 'en-US' },
    });

    render(<Medium />);

    expect(document.documentElement.dataset.theme).toBe('light');
    expect(document.documentElement.lang).toBe('en-US');
  });

  it('narrows the icon gallery to names containing the query', () => {
    const { CategoryIcons } = composeStories(iconStories);
    render(<CategoryIcons />);

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: ' PETS ' } });

    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual(['pets']);
  });

  it('selects the clicked segment and reports it', () => {
    const { Medium } = composeStories(segmentedStories);
    render(<Medium />);

    fireEvent.click(screen.getByText('$'));

    expect(screen.getByRole<HTMLInputElement>('radio', { name: '$' }).checked).toBe(true);
    expect(Medium.args.onChange).toHaveBeenCalledExactlyOnceWith('USD');
  });
});
