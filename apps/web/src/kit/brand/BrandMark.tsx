import { brand } from '../../config/constants';
import { Icon } from '../icons/Icon';

// The kit's brand mark (K34, OQ-135): the mint savings tile and the product's
// name, as the auth brand panel, the setup wizard's bar and the App Shell's
// header draw it. The name is a proper noun from `config/constants.ts`.

/** The mark's size: the shell and wizard bars' 32px tile, or the auth panel's 40px. */
export type BrandMarkSize = 'md' | 'lg';

/** The brand mark's props. */
export interface BrandMarkProps {
  /** Defaults to `md`. */
  readonly size?: BrandMarkSize | undefined;
}

const TILES: Record<BrandMarkSize, string> = {
  md: 'size-8 rounded-[10px] text-lg',
  lg: 'size-10 rounded-xl text-[1.375rem]',
};

const NAMES: Record<BrandMarkSize, string> = {
  md: 'font-display font-semibold',
  lg: 'type-heading-sm',
};

/**
 * Renders the brand mark. The tile is decorative: the name follows it.
 *
 * @param props - The size.
 * @returns The tile and the name.
 */
export function BrandMark({ size = 'md' }: BrandMarkProps) {
  return (
    <span className="flex items-center gap-3">
      <span className={`grid place-items-center bg-mint text-onmint2 ${TILES[size]}`}>
        <Icon name="savings-outline" />
      </span>
      <span className={NAMES[size]}>{brand.name}</span>
    </span>
  );
}
