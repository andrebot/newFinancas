import {
  describe, expect, it, vi,
} from 'vitest';
import {
  type ContractTerms, createInvestmentProductEngine, type ScheduleEntry, type ScheduleResult,
} from '../../../../src/engines/investmentProduct';

const HOUSEHOLD = 'h1';

// A fixed 12% CDB, 2025-01-02 → 2027-01-04: 732 days held, the 15% bracket.
const CDB: ContractTerms = {
  assetType: 'cdb',
  incentivised: null,
  date: '2025-01-02',
  amount: 1_000_000,
  dueDate: '2027-01-04',
  rate: { type: 'fixed', value: 120_000 },
  interestPayment: 'at_maturity',
};

// Tesouro IPCA+ 5.5%, semi-annual coupons on Jan/Jul 1st — two of them on a
// holiday (New Year), paid the next business day.
const TESOURO_IPCA: ContractTerms = {
  assetType: 'tesouro_direto',
  incentivised: null,
  date: '2025-03-10',
  amount: 1_000_000,
  dueDate: '2027-01-01',
  rate: { type: 'ipca', value: 55_000 },
  interestPayment: 'semiannual',
};

/**
 * Builds the Engine over a fake index-rate read — the Accessor directly
 * beneath it (BDT).
 *
 * @param value - The index's latest value, or `undefined` for none recorded.
 * @returns The Engine and its fake.
 */
const setup = (value?: number) => {
  const latestIndexRate = vi.fn(async () => (value === undefined ? undefined : {
    id: 'r1',
    householdId: HOUSEHOLD,
    indexCode: 'ipca' as const,
    value,
    asOfDate: '2025-02-01',
    createdByUserId: null,
    createdAt: new Date(),
  }));
  return { engine: createInvestmentProductEngine({ latestIndexRate }), latestIndexRate };
};

/**
 * Unwraps a schedule the test expects to be accepted.
 *
 * @param result - What `schedule` resolved to.
 * @returns Its entries.
 */
const entriesOf = async (result: Promise<ScheduleResult>): Promise<ScheduleEntry[]> => {
  const resolved = await result;
  if (!resolved.ok) throw new Error(`Unexpected refusal: ${resolved.reason}`);
  return resolved.entries;
};

describe('schedule (FR-11.2, OQ-201, OQ-205)', () => {
  it('returns interest, tax and redemption on one date at maturity, reading no index', async () => {
    const { engine, latestIndexRate } = setup();

    expect(await engine.schedule(HOUSEHOLD, CDB)).toEqual({
      ok: true,
      entries: [
        { kind: 'interest_payment', amount: 252_709, date: '2027-01-04' },
        { kind: 'tax', amount: 37_906, date: '2027-01-04' },
        { kind: 'redemption', amount: 1_000_000, date: '2027-01-04' },
      ],
    });
    expect(latestIndexRate).not.toHaveBeenCalled();
  });

  it('pays each semi-annual coupon on a business day, taxed at its own bracket', async () => {
    const { engine, latestIndexRate } = setup(45_000);

    expect(await engine.schedule(HOUSEHOLD, TESOURO_IPCA)).toEqual({
      ok: true,
      entries: [
        { kind: 'interest_payment', amount: 30_258, date: '2025-07-01' },
        { kind: 'tax', amount: 6_808, date: '2025-07-01' },
        { kind: 'interest_payment', amount: 51_615, date: '2026-01-02' },
        { kind: 'tax', amount: 10_323, date: '2026-01-02' },
        { kind: 'interest_payment', amount: 48_363, date: '2026-07-01' },
        { kind: 'tax', amount: 8_464, date: '2026-07-01' },
        { kind: 'interest_payment', amount: 50_395, date: '2027-01-04' },
        { kind: 'tax', amount: 8_819, date: '2027-01-04' },
        { kind: 'redemption', amount: 1_000_000, date: '2027-01-04' },
      ],
    });
    expect(latestIndexRate).toHaveBeenCalledWith(HOUSEHOLD, 'ipca');
  });

  it('pays monthly coupons, one interest entry per month', async () => {
    const { engine } = setup();

    const entries = await entriesOf(engine.schedule(HOUSEHOLD, {
      ...CDB, date: '2025-01-15', dueDate: '2025-05-30', interestPayment: 'monthly',
    }));

    expect(entries.filter((entry) => entry.kind === 'interest_payment').map((entry) => entry.date))
      .toEqual(['2025-01-30', '2025-02-28', '2025-03-31', '2025-04-30', '2025-05-30']);
  });

  it('refuses an index-linked rate whose index has no value yet (OQ-205)', async () => {
    const { engine, latestIndexRate } = setup();

    expect(await engine.schedule(HOUSEHOLD, {
      ...CDB, rate: { type: 'cdi', value: 1_100_000 },
    })).toEqual({ ok: false, reason: 'index_missing', indexCode: 'cdi' });
    expect(latestIndexRate).toHaveBeenCalledWith(HOUSEHOLD, 'cdi');
  });

  it.each([
    ['lci', null], ['lca', null], ['cra', null], ['cri', null], ['debenture', true],
  ] as const)('writes no tax for an exempt %s (flag %s)', async (assetType, incentivised) => {
    const { engine } = setup();

    const entries = await entriesOf(engine.schedule(HOUSEHOLD, {
      ...CDB, assetType, incentivised,
    }));

    expect(entries.map((entry) => entry.kind)).toEqual(['interest_payment', 'redemption']);
  });

  it.each(['cdb', 'lc', 'lf', 'tesouro_direto', 'debenture'])('taxes a %s', async (assetType) => {
    const { engine } = setup();

    const entries = await entriesOf(engine.schedule(HOUSEHOLD, {
      ...CDB, assetType, incentivised: false,
    }));

    expect(entries.map((entry) => entry.kind)).toEqual(['interest_payment', 'tax', 'redemption']);
  });

  it.each(['cd', 'treasury'])('accrues a US %s on actual/365, rolls a Saturday, no tax', async (
    assetType,
  ) => {
    const { engine } = setup();

    expect(await engine.schedule(HOUSEHOLD, {
      ...CDB,
      assetType,
      date: '2025-01-01',
      dueDate: '2026-01-03',
      rate: { type: 'fixed', value: 50_000 },
    })).toEqual({
      ok: true,
      entries: [
        { kind: 'interest_payment', amount: 50_281, date: '2026-01-05' },
        { kind: 'redemption', amount: 1_000_000, date: '2026-01-05' },
      ],
    });
  });

  it('refuses a type that is not fixed-term — the Manager never sends one', async () => {
    const { engine } = setup();

    await expect(engine.schedule(HOUSEHOLD, { ...CDB, assetType: 'stock' }))
      .rejects.toThrow('Not a fixed-term asset type: stock');
  });
});

describe('project (FR-11.2, OQ-58, OQ-205)', () => {
  it('projects a fixed rate without reading an index', async () => {
    const { engine, latestIndexRate } = setup();

    expect(await engine.project(HOUSEHOLD, CDB)).toEqual({
      ok: true, expectedPayout: 1_252_709, expectedTaxes: { estimated: true, amount: 37_906 },
    });
    expect(latestIndexRate).not.toHaveBeenCalled();
  });

  it('sums every coupon with the latest index value', async () => {
    const { engine } = setup(45_000);

    expect(await engine.project(HOUSEHOLD, TESOURO_IPCA)).toEqual({
      ok: true, expectedPayout: 1_180_631, expectedTaxes: { estimated: true, amount: 34_414 },
    });
  });

  it('refuses when the index has no value yet (OQ-205)', async () => {
    const { engine } = setup();

    expect(await engine.project(HOUSEHOLD, TESOURO_IPCA))
      .toEqual({ ok: false, reason: 'index_missing', indexCode: 'ipca' });
  });

  it('expects no tax from an exempt type', async () => {
    const { engine } = setup();

    expect(await engine.project(HOUSEHOLD, { ...CDB, assetType: 'lci' }))
      .toMatchObject({ ok: true, expectedTaxes: { estimated: true, amount: 0 } });
  });

  it('does not estimate a US instrument\'s taxes (OQ-79)', async () => {
    const { engine } = setup();

    expect(await engine.project(HOUSEHOLD, {
      ...CDB,
      assetType: 'cd',
      date: '2025-01-01',
      dueDate: '2026-01-03',
      rate: { type: 'fixed', value: 50_000 },
    })).toEqual({ ok: true, expectedPayout: 1_050_281, expectedTaxes: { estimated: false } });
  });
});
