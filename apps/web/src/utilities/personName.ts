// How a person's name reads wherever the app prints one (code review A4,
// OQ-163): the first and last name joined, a blank part skipped. Formatting,
// so it belongs to no Flow; FormattingUtility (FU6) can take it in later.

/** A person's names, as the API sends them. */
export interface PersonName {
  readonly firstName: string;
  readonly lastName: string;
}

/**
 * Joins a person's names, as rows, confirms and toasts print them.
 *
 * @param name - The first and last name.
 * @returns E.g. "Sam Costa"; one name alone when the other is blank.
 */
export const fullName = ({ firstName, lastName }: PersonName): string => (
  [firstName, lastName].filter(Boolean).join(' ')
);
