import { avatar } from '../../config/constants';

// The kit's avatar (K31, OQ-134): a person's initials in a tinted circle, as
// on the household members list, the nav drawer and the profile header. It is
// decorative: the person's name is always printed next to it.

/** The avatar's colour: the signed-in user's mint, or a member's accent. */
export type AvatarTone = typeof avatar.selfTone | (typeof avatar.memberTones)[number];

/** The avatar's size: 40px for rows and the drawer, 64px for the profile header. */
export type AvatarSize = 'md' | 'lg';

/** The avatar's props. */
export interface AvatarProps {
  /** The person's first name, as the API returns it. */
  readonly firstName: string;
  /** The person's last name, as the API returns it. */
  readonly lastName: string;
  /** Usually from `avatarTone`, so a person looks the same everywhere. */
  readonly tone: AvatarTone;
  /** Defaults to `md`. */
  readonly size?: AvatarSize | undefined;
  /** Extra classes, e.g. a margin. */
  readonly className?: string | undefined;
}

const TONES: Record<AvatarTone, string> = {
  mint: 'bg-mint/15 text-mint',
  sky: 'bg-sky/15 text-sky',
  sun: 'bg-sun/15 text-sun',
  lilac: 'bg-lilac/15 text-lilac',
};

const SIZES: Record<AvatarSize, string> = {
  md: 'size-10 text-sm',
  lg: 'size-16 text-2xl',
};

/**
 * Takes the first character of a name, whole even outside the BMP, uppercased.
 *
 * @param name - A first or last name.
 * @returns Its initial, or an empty string for a blank name.
 */
const initialOf = (name: string) => (Array.from(name.trim())[0] ?? '').toUpperCase();

/**
 * Builds a person's initials: the first letter of each name.
 *
 * @param firstName - The person's first name.
 * @param lastName - The person's last name.
 * @returns E.g. "JD" for Jane Doe, "ÉÑ" for Élodie Ñúñez.
 */
export const avatarInitials = (firstName: string, lastName: string) => (
  `${initialOf(firstName)}${initialOf(lastName)}`
);

/**
 * Hashes a user id to a whole number (a 31-multiplier string hash), so the
 * same id always lands on the same member colour.
 *
 * @param userId - The person's user id.
 * @returns A non-negative 32-bit hash.
 */
const hashUserId = (userId: string) => Array.from(userId).reduce(
  (hash, character) => (hash * 31 + character.codePointAt(0)!) % (2 ** 32),
  0,
);

/**
 * Picks a person's avatar colour: mint for the signed-in user; anyone else
 * keeps the colour their id hashes to, on every screen and device.
 *
 * @param userId - The person's user id.
 * @param isSelf - Whether the person is the signed-in user.
 * @returns The avatar's tone.
 */
export const avatarTone = (userId: string, isSelf: boolean): AvatarTone => (
  isSelf
    ? avatar.selfTone
    : avatar.memberTones[hashUserId(userId) % avatar.memberTones.length]!
);

/**
 * Builds the classes of an avatar.
 *
 * @param tone - The avatar's colour.
 * @param size - The avatar's size.
 * @param className - The caller's extra classes, if any.
 * @returns The avatar's classes.
 */
export const avatarClasses = (tone: AvatarTone, size: AvatarSize, className?: string) => [
  'grid shrink-0 place-items-center rounded-full font-display font-extrabold leading-none',
  TONES[tone],
  SIZES[size],
  className,
].filter(Boolean).join(' ');

/**
 * Renders the initials avatar, hidden from screen readers.
 *
 * @param props - The names, the tone, the size and extra classes.
 * @returns The tinted circle.
 */
export function Avatar({
  firstName, lastName, tone, size = 'md', className,
}: AvatarProps) {
  return (
    <span aria-hidden="true" className={avatarClasses(tone, size, className)}>
      {avatarInitials(firstName, lastName)}
    </span>
  );
}
