// Money as the web app writes it (FormattingUtility, NFR-I18N-2): a BRL
// amount keeps BRL's own conventions in the en-US journeys, `R$ 1.234,56`,
// with the true minus sign — so a journey can look for the figure a card shows.

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/**
 * Writes an amount of reais as a card shows it.
 *
 * @param cents - The amount in centavos, as the API sends it.
 * @returns E.g. `R$ 954,50`, `−R$ 45,50`.
 */
const brl = (cents: number): string => BRL.format(cents / 100).replace('-', '−');

export default brl;
