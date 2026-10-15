// Reads a User-Agent (OQ-154): a session's `deviceInfo` is the raw header the
// device signed in with, and the profile names it as "Chrome on macOS" with a
// laptop or phone mark (mockup 70). The browser and system names are brands,
// never translated; the caller joins them in its own locale. The patterns are
// the header's own grammar, so they stay here rather than in the config.

/** The kind of device, for its glyph. */
export type DeviceKind = 'laptop' | 'desktop' | 'phone' | 'tablet' | 'unknown';

/** What a User-Agent says about the device; a part it doesn't say is absent. */
export interface DeviceDescription {
  /** The browser's brand, e.g. `Chrome`. */
  readonly browser?: string | undefined;
  /** The system's brand, e.g. `macOS`. */
  readonly system?: string | undefined;
  readonly kind: DeviceKind;
}

/** A brand and the pattern that gives it away. */
type Brand = readonly [name: string, pattern: RegExp];

// Order matters: Edge, Opera and Samsung Internet carry "Chrome/" too, and
// Chrome carries "Safari/".
const BROWSERS: readonly Brand[] = [
  ['Edge', /Edg(A|iOS)?\//],
  ['Opera', /OPR\//],
  ['Samsung Internet', /SamsungBrowser\//],
  ['Firefox', /(Firefox|FxiOS)\//],
  ['Chrome', /(Chrome|CriOS)\//],
  ['Safari', /Version\/.*Safari\//],
];

// Order matters: iPhone and iPad headers say "like Mac OS X", and Android's
// say "Linux".
const SYSTEMS: readonly Brand[] = [
  ['iOS', /iPhone/],
  ['iPadOS', /iPad/],
  ['Android', /Android/],
  ['Windows', /Windows/],
  ['ChromeOS', /CrOS/],
  ['macOS', /Mac OS X/],
  ['Linux', /Linux/],
];

/** The device a system runs on when the header doesn't say "Mobile". */
const KINDS: Readonly<Record<string, DeviceKind>> = {
  iOS: 'phone',
  iPadOS: 'tablet',
  Android: 'tablet',
  macOS: 'laptop',
};

/**
 * Finds the first brand whose pattern the header matches.
 *
 * @param brands - The brands, in the order to try them.
 * @param userAgent - The header.
 * @returns The brand's name, or `undefined`.
 */
const brandOf = (brands: readonly Brand[], userAgent: string) => (
  brands.find(([, pattern]) => pattern.test(userAgent))?.[0]
);

/**
 * Works out the kind of device: an Android phone says "Mobile", an Android
 * tablet doesn't; the other systems tell it on their own.
 *
 * @param system - The system's brand, if found.
 * @param userAgent - The header.
 * @returns The kind.
 */
const kindOf = (system: string | undefined, userAgent: string): DeviceKind => {
  if (system === undefined) return 'unknown';
  if (system === 'Android' && /Mobile/.test(userAgent)) return 'phone';
  return KINDS[system] ?? 'desktop';
};

/**
 * Describes the device behind a User-Agent.
 *
 * @param userAgent - The header, or `null` when the device sent none.
 * @returns The browser, the system and the kind of device.
 */
export const describeUserAgent = (userAgent: string | null): DeviceDescription => {
  if (!userAgent) return { kind: 'unknown' };
  const system = brandOf(SYSTEMS, userAgent);

  return {
    browser: brandOf(BROWSERS, userAgent),
    system,
    kind: kindOf(system, userAgent),
  };
};
