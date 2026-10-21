// A field the actor can't change, shown with its label (FL11): the edit
// drawer's type and currency (fixed at creation), a visibility only its
// creator may move, and a Viewer's create form, where an account is personal.

/** A locked field's props. */
export interface LockedFieldProps {
  readonly label: string;
  readonly value: string;
}

/**
 * Renders a field the actor can't change, with its label above it.
 *
 * @param props - Its label and value.
 * @returns The locked field.
 */
export function LockedField({ label, value }: LockedFieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm text-muted">{label}</span>
      <span className="rounded-md border border-line bg-bg px-3 py-2 text-sm">{value}</span>
    </div>
  );
}
