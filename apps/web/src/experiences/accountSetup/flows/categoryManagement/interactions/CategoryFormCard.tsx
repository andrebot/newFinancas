import { useState } from 'react';
import type { CategoryColor, CategoryIcon } from '@financas/api-types';
import { Button } from '../../../../../kit/button/Button';
import { ColorSwatchPicker } from '../../../../../kit/colorSwatchPicker/ColorSwatchPicker';
import { IconPicker } from '../../../../../kit/iconPicker/IconPicker';
import { TextField } from '../../../../../kit/textField/TextField';
import { InlineBanner } from '../../../../../kit/alert/InlineBanner';
import { useI18n } from '../../../../../utilities/I18nProvider';
import { nonBlank } from '../../../../../utilities/validation';

// The category form card (FL12, mockup 41; OQ-193): the dashed card in the
// grid — a name, an icon and a colour. It doubles as create (empty) and edit
// (pre-filled, its own card turned into it). It holds what is typed, checks
// the name before emitting, and shows the server's objections in its banner.
// Whether a form is open at all belongs to the Flow; this renders its content.

/** The icon an empty create form starts from (OQ-193). */
export const DEFAULT_CATEGORY_ICON: CategoryIcon = 'category-outline';

/** The colour an empty create form starts from (OQ-193). */
export const DEFAULT_CATEGORY_COLOR: CategoryColor = 'mint';

/** What a pre-filled edit starts from. */
export interface FormInitial {
  readonly name: string;
  readonly icon: CategoryIcon;
  readonly color: CategoryColor;
}

/** The form card's props. */
export interface CategoryFormCardProps {
  /** Create shows the empty card, edit its pre-filled one. */
  readonly mode: 'create' | 'edit';
  /** The category an edit starts from. */
  readonly initial?: FormInitial | undefined;
  /** Its own request is out: the button spins and ignores submits. */
  readonly busy: boolean;
  /** Another request is out: the buttons wait. */
  readonly disabled: boolean;
  /** A failure of the last create or edit, already translated. */
  readonly alert?: string | undefined;
  /** Gets the fields once they pass. */
  readonly onSubmit: (name: string, icon: CategoryIcon, color: CategoryColor) => void;
  /** Closes the card again. */
  readonly onCancel: () => void;
}

/**
 * Renders the category's form as a dashed card in the grid.
 *
 * @param props - The mode, its starting fields and the Flow's handlers.
 * @returns The form card.
 */
export function CategoryFormCard({
  mode, initial, busy, disabled, alert, onSubmit, onCancel,
}: CategoryFormCardProps) {
  const translator = useI18n();
  // An edit starts from its category's fields; a create from the defaults (OQ-193).
  const start = initial ?? { name: '', icon: DEFAULT_CATEGORY_ICON, color: DEFAULT_CATEGORY_COLOR };
  const [name, setName] = useState(start.name);
  const [icon, setIcon] = useState<CategoryIcon>(start.icon);
  const [color, setColor] = useState<CategoryColor>(start.color);
  const [nameError, setNameError] = useState<string | undefined>(undefined);

  /** Checks the name and emits the fields. */
  const submit = () => {
    const foundName = nonBlank(name);
    if (foundName !== undefined) {
      setNameError(translator.field(foundName.code, foundName.params));
      return;
    }
    onSubmit(name.trim(), icon, color);
  };

  const caption = translator.text('categoryManagement', `${mode}.caption`);
  const submitLabel = translator.text('categoryManagement', `${mode}.submit`);

  return (
    <div className="flex flex-col gap-4 rounded-xl2 border border-dashed border-mint/40 p-5">
      <span className="text-sm font-semibold text-muted">{caption}</span>
      {alert && <InlineBanner tone="error" message={alert} />}
      <TextField
        label={translator.text('categoryManagement', 'field.name')}
        value={name}
        onChange={(value) => {
          setName(value);
          if (nameError !== undefined) setNameError(undefined);
        }}
        error={nameError}
      />
      <IconPicker
        label={translator.text('categoryManagement', 'icon.label')}
        moreLabel={translator.text('categoryManagement', 'icon.more')}
        value={icon}
        onChange={setIcon}
        iconLabel={(value) => translator.text('categoryIcons', value)}
      />
      <ColorSwatchPicker
        label={translator.text('categoryManagement', 'color.label')}
        value={color}
        onChange={setColor}
        colorLabel={(value) => translator.text('paletteColors', value)}
      />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel} disabled={busy}>
          {translator.text('categoryManagement', 'cancel')}
        </Button>
        <Button busy={busy} disabled={disabled} onClick={submit}>
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}
