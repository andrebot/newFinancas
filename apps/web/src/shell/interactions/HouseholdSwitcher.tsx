import { useId, useState } from 'react';
import { Icon } from '../../kit/icons/Icon';
import { Tag } from '../../kit/tag/Tag';
import { useI18n } from '../../utilities/I18nProvider';
import type { ShellHousehold } from '../shellConfig';

// The nav drawer's household switcher (S1, mockup 21; FR-1.8): a card naming
// the active household that unfolds into every household the user belongs to,
// each with their role in it, the active one checked. Under them: the
// invitations waiting for the user's answer and "Create household". The card
// emits the user's pick; switching itself is the shell's (OQ-156).

/** The switcher's props. */
export interface HouseholdSwitcherProps {
  /** The user's households, in the API's order. */
  readonly households: readonly ShellHousehold[];
  readonly activeId: string;
  /** Invitations waiting for the user's answer; the row shows only when there are some. */
  readonly pendingInvitationCount: number;
  readonly onSwitch: (householdId: string) => void;
  readonly onOpenInvitations: () => void;
  readonly onCreateHousehold: () => void;
}

const ROW = [
  'flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left',
  'outline-none hover:bg-ink/5 focus-visible:bg-ink/5',
].join(' ');

const TOGGLE = [
  'flex w-full items-center gap-3 px-3 py-2.5 text-left',
  'outline-none focus-visible:bg-ink/5',
].join(' ');

const EYEBROW = 'type-caption font-semibold tracking-wider text-faint uppercase';

/**
 * Builds the card's classes: its border turns mint while unfolded.
 *
 * @param open - Whether the list shows.
 * @returns The classes.
 */
export const switcherCardClasses = (open: boolean) => [
  'overflow-hidden rounded-2xl border bg-raised/60',
  open ? 'border-mint/40' : 'border-line',
].join(' ');

/**
 * Builds one household row's classes: the active one tinted mint.
 *
 * @param active - Whether it is the active household.
 * @returns The classes.
 */
export const householdRowClasses = (active: boolean) => (active ? `${ROW} bg-mint/10` : ROW);

/** One household row's props. */
interface HouseholdRowProps {
  readonly household: ShellHousehold;
  readonly active: boolean;
  readonly onPick: () => void;
}

/**
 * Renders one household: home for the one the user owns, people otherwise;
 * mint while active, with a check.
 *
 * @param props - The household, whether it is active and the pick handler.
 * @returns The row.
 */
function HouseholdRow({ household, active, onPick }: HouseholdRowProps) {
  const translator = useI18n();
  const glyph = household.role === 'Owner' ? 'home-outline' : 'groups-outline';
  const tone = active ? 'bg-mint/15 text-mint' : 'bg-sky/15 text-sky';

  return (
    <li>
      <button
        type="button"
        aria-current={active || undefined}
        className={householdRowClasses(active)}
        onClick={onPick}
      >
        <span className={`grid size-7 shrink-0 place-items-center rounded-lg ${tone}`}>
          <Icon name={glyph} className="size-4" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate type-body-sm font-medium">{household.name}</span>
          {/* Keeps the name and the role apart in the button's name; flex drops it visually. */}
          {' '}
          <span className="type-caption text-muted">
            {translator.text('membership', `role.${household.role}`)}
          </span>
        </span>
        {active && <Icon name="check" className="size-4.5 shrink-0 text-mint" />}
      </button>
    </li>
  );
}

/**
 * Renders the switcher card: folded, it names the active household; unfolded,
 * it lists them all with the invitations and Create household rows.
 *
 * @param props - The households, the active one, the invitation count and the handlers.
 * @returns The card.
 */
export function HouseholdSwitcher({
  households, activeId, pendingInvitationCount, onSwitch, onOpenInvitations, onCreateHousehold,
}: HouseholdSwitcherProps) {
  const translator = useI18n();
  const listId = useId();
  const [open, setOpen] = useState(false);
  const active = households.find((household) => household.id === activeId);

  return (
    <div className={switcherCardClasses(open)}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        className={TOGGLE}
        onClick={() => setOpen(!open)}
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-mint/15 text-mint">
          <Icon name="home-outline" className="size-4.5" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className={EYEBROW}>
            {translator.text('shell', 'household.label')}
          </span>
          {' '}
          <span className="truncate type-body-sm font-semibold">{active?.name}</span>
        </span>
        <Icon name="unfold-more" className="size-4.5 shrink-0 text-muted" />
      </button>
      {open && (
        <div id={listId} className="flex flex-col gap-0.5 border-t border-line p-1.5">
          <ul className="flex flex-col gap-0.5">
            {households.map((household) => (
              <HouseholdRow
                key={household.id}
                household={household}
                active={household.id === activeId}
                onPick={() => onSwitch(household.id)}
              />
            ))}
          </ul>
          <div className="my-1 h-px bg-line" />
          {pendingInvitationCount > 0 && (
            <button
              type="button"
              className={`${ROW} type-body-sm text-muted`}
              onClick={onOpenInvitations}
            >
              <Icon name="mail-outline" className="size-4.5 w-7 shrink-0" />
              {translator.text('shell', 'household.pendingInvitations')}
              {' '}
              <span className="ml-auto">
                <Tag tone="mint">{pendingInvitationCount}</Tag>
              </span>
            </button>
          )}
          <button
            type="button"
            className={`${ROW} type-body-sm font-medium text-mint`}
            onClick={onCreateHousehold}
          >
            <Icon name="add-home-outline" className="size-4.5 w-7 shrink-0" />
            {translator.text('shell', 'household.create')}
          </button>
        </div>
      )}
    </div>
  );
}
