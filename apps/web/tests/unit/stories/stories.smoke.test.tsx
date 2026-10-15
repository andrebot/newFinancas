import { composeStories, setProjectAnnotations, type Meta } from '@storybook/react-vite';
import {
  act, fireEvent, render, screen,
} from '@testing-library/react';
import type { ComponentType } from 'react';
import { describe, expect, it } from 'vitest';
import preview from '../../../.storybook/preview';
import * as checkboxStories from '../../../stories/kit/checkbox/Checkbox.stories';
import * as iconStories from '../../../stories/kit/icons/Icon.stories';
import * as optionCardStories from '../../../stories/kit/optionCard/OptionCardGroup.stories';
import * as popoverStories from '../../../stories/kit/popover/Popover.stories';
import * as selectStories from '../../../stories/kit/select/Select.stories';
import * as segmentedStories from '../../../stories/kit/segmentedControl/SegmentedControl.stories';
import * as textFieldStories from '../../../stories/kit/textField/TextField.stories';
import { fixedLocaleController } from '../../../stories/support/StoryFrame';

// Smoke test for the component library (N14, OQ-128): every story renders
// through the real preview (StoryFrame's theme and locale) without throwing.
// It catches a story broken by a kit change that still typechecks. The
// story-only behaviours (icon search, the state a controlled story keeps,
// the popover's content) get one check each.

type StoryModule = { default: Meta } & Record<string, unknown>;

// Before any composeStories call: stories composed earlier miss the preview's
// decorators, so they'd render without StoryFrame.
setProjectAnnotations(preview);

const modules = import.meta.glob<StoryModule>('../../../stories/**/*.stories.tsx', {
  eager: true,
});

const cases = Object.entries(modules).flatMap(([path, module]) => (
  Object.entries(composeStories(module)).map(([name, Story]) => ({
    title: `${path.replace('../../../stories/', '')} › ${name}`,
    Story: Story as ComponentType,
  }))
));

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

  it('ticks the clicked checkbox and reports it', () => {
    const { Unchecked } = composeStories(checkboxStories);
    render(<Unchecked />);

    fireEvent.click(screen.getByRole('checkbox'));

    expect(screen.getByRole<HTMLInputElement>('checkbox').checked).toBe(true);
    expect(Unchecked.args.onChange).toHaveBeenCalledExactlyOnceWith(true);
  });

  it('selects the clicked option card and reports it', () => {
    const { ListOfSeveral } = composeStories(optionCardStories);
    render(<ListOfSeveral />);

    fireEvent.click(screen.getByRole('radio', { name: /Checking/ }));

    expect(screen.getByRole<HTMLInputElement>('radio', { name: /Checking/ }).checked).toBe(true);
    expect(ListOfSeveral.args.onChange).toHaveBeenCalledExactlyOnceWith('checking');
  });

  it('keeps the typed text and reports it', () => {
    const { Filled } = composeStories(textFieldStories);
    render(<Filled />);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Casa Silva' } });

    expect(screen.getByRole<HTMLInputElement>('textbox').value).toBe('Casa Silva');
    expect(Filled.args.onChange).toHaveBeenCalledExactlyOnceWith('Casa Silva');
  });

  it('keeps the picked option and reports it', async () => {
    const { Accounts } = composeStories(selectStories);
    render(<Accounts />);

    await act(async () => {
      fireEvent.click(screen.getByRole('combobox', { name: 'From account' }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('option', { name: /Nubank/ }));
    });

    expect(screen.getByRole('combobox').textContent).toContain('Nubank');
    expect(Accounts.args.onChange).toHaveBeenCalledExactlyOnceWith('nubank');
  });

  it('shows the inbox rows once the bell opens the popover', async () => {
    const { NotificationInbox } = composeStories(popoverStories);
    render(<NotificationInbox />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Notifications' }));
    });

    expect(screen.getByText('Priya Shah accepted your invitation')).toBeDefined();
  });

  it('closes the popover from its own content', async () => {
    const { ClosesFromInside } = composeStories(popoverStories);
    render(<ClosesFromInside />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Notifications' }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    });

    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('fixedLocaleController', () => {
  it('always reports its locale and ignores the rest', () => {
    const controller = fixedLocaleController('en-US');

    controller.apply('pt-BR');
    controller.restore();
    const unsubscribe = controller.subscribe(() => {});
    unsubscribe();

    expect(controller.current()).toBe('en-US');
  });
});
