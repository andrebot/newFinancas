import type { CardNetwork } from '@financas/reference';

// What the icon registry holds (OQ-126). Category icons are not repeated here:
// they come from `CATEGORY_ICONS` in @financas/reference, the list the API
// validates against, so the registry always covers every stored category icon.

/**
 * UI icons (Material Symbols names): every icon the approved mockups use outside
 * category icons, plus `visibility-off-outline` for the password field's hide
 * state and `progress-activity` for the busy button's spinner (K4). Add a name
 * here and run `pnpm generate:icons` when a screen needs one.
 */
export const UI_ICONS = [
  'account-balance-wallet-outline', 'add', 'add-card-outline', 'add-circle-outline',
  'add-home-outline', 'add-shopping-cart', 'archive-outline', 'arrow-back', 'arrow-forward',
  'arrow-upward', 'barcode', 'call-made', 'candlestick-chart-outline', 'check',
  'check-circle', 'check-circle-outline', 'chevron-left', 'chevron-right', 'close',
  'cloud-download-outline', 'content-copy-outline', 'contrast', 'credit-card-off-outline',
  'crown-outline', 'currency-exchange', 'dark-mode-outline', 'delete-outline',
  'description-outline', 'desktop-windows-outline', 'donut-large', 'download',
  'edit-note-outline', 'edit-outline', 'event-available-outline', 'expand-less',
  'expand-more', 'filter-list', 'flag-outline', 'group-add-outline', 'group-outline',
  'groups-outline', 'history', 'info-outline', 'inventory-2-outline', 'key-outline',
  'laptop-mac-outline', 'light-mode-outline', 'lightbulb-outline', 'lock-outline',
  'lock-reset', 'logout', 'mail-outline', 'mark-email-read-outline', 'menu', 'more-horiz',
  'north-east', 'notifications-outline', 'password', 'percent', 'person-add-outline',
  'person-outline', 'person-remove-outline', 'phone-iphone-outline', 'pie-chart-outline',
  'progress-activity',
  'query-stats', 'search', 'send-outline', 'shield-lock-outline', 'shield-person-outline',
  'south-west', 'space-dashboard-outline', 'swap-horiz', 'table-rows-outline', 'undo',
  'unfold-more', 'verified-user-outline', 'visibility-off-outline', 'visibility-outline',
  'warning-outline',
] as const;

/**
 * The `logos` icon (Iconify "SVG Logos", CC0) for each card network. `other`
 * has no logo; the kit shows the generic `credit-card-outline` icon for it.
 */
export const CARD_NETWORK_LOGOS: Readonly<Record<Exclude<CardNetwork, 'other'>, string>> = {
  visa: 'visa',
  mastercard: 'mastercard',
  amex: 'amex',
  elo: 'elo',
  hipercard: 'hipercard',
  diners: 'dinersclub',
  discover: 'discover',
  jcb: 'jcb',
  unionpay: 'unionpay',
};
