// Shared Manager plumbing: running Accessor calls one after another. Inside one
// transaction (OQ-175) the calls share a connection, so each must finish before
// the next starts — a nested write opens a savepoint, and two at once would interleave.

/**
 * Runs a step for each item, one at a time, in order.
 *
 * @param items - The items.
 * @param step - What to do with one item.
 * @returns Each step's result, in the items' order.
 */
const inSequence = <Item, Result>(
  items: readonly Item[],
  step: (item: Item) => Promise<Result>,
): Promise<Result[]> => items.reduce<Promise<Result[]>>(
  async (done, item) => {
    const results = await done;
    return [...results, await step(item)];
  },
  Promise.resolve([]),
);

export default inSequence;
