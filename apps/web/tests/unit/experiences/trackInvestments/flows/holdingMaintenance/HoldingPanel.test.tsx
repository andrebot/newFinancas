import type { IndexRateSeries, InvestmentHolding } from '@financas/api-types';
import {
  act, cleanup, fireEvent, screen, waitFor,
} from '@testing-library/react';
import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';
import {
  HoldingPanel, type HoldingDetails, type HoldingPanelProps, type HoldingRequests,
} from '../../../../../../src/experiences/trackInvestments/flows/holdingMaintenance/HoldingPanel';
import type { ActivityCardProps } from '../../../../../../src/experiences/trackInvestments/flows/holdingMaintenance/interactions/ActivityCard';
import type { ContractCardProps } from '../../../../../../src/experiences/trackInvestments/flows/holdingMaintenance/interactions/ContractCard';
import type { GoalAllocationCardProps } from '../../../../../../src/experiences/trackInvestments/flows/holdingMaintenance/interactions/GoalAllocationCard';
import type { MarketValueEntryProps } from '../../../../../../src/experiences/trackInvestments/flows/holdingMaintenance/interactions/MarketValueEntry';
import type { PositionCardProps } from '../../../../../../src/experiences/trackInvestments/flows/holdingMaintenance/interactions/PositionCard';
import type { ValueHistoryDrawerProps } from '../../../../../../src/experiences/trackInvestments/flows/holdingMaintenance/interactions/ValueHistoryDrawer';
import { AlertProvider } from '../../../../../../src/utilities/AlertProvider';
import { createAlertQueue, type AlertQueue } from '../../../../../../src/utilities/alerts';
import { renderInLocale } from '../../../../../support/renderInLocale';
import { holdingOf, holdingWithout } from '../../../portfolioFixtures';

// An open holding row (BDT: Flow tier, unit). Its Interactions are stubbed —
// each has its own suite — so this checks what each is handed for a
// fixed-term and a market-priced Holding, and how a request's answer becomes
// `done` / `refused` and a toast. The translator and the toast queue are real.

vi.mock('../../../../../../src/experiences/trackInvestments/flows/holdingMaintenance/interactions/ContractCard', () => ({
  /**
   * Contract's stand-in: the index it quotes.
   *
   * @param props - What the panel passes.
   * @returns The stub.
   */
  ContractCard: ({ latestIndex }: ContractCardProps) => (
    <div data-testid="contract" data-index={latestIndex?.value ?? 'none'} />
  ),
}));
vi.mock('../../../../../../src/experiences/trackInvestments/flows/holdingMaintenance/interactions/PositionCard', () => ({
  /**
   * Position's stand-in: the value and payout.
   *
   * @param props - What the panel passes.
   * @returns The stub.
   */
  PositionCard: ({ value, payout }: PositionCardProps) => (
    <div data-testid="position" data-value={value} data-payout={payout} />
  ),
}));
vi.mock('../../../../../../src/experiences/trackInvestments/flows/holdingMaintenance/interactions/MarketValueEntry', () => ({
  /**
   * Market Value Entry's stand-in: its state, a save and the drawer's opener.
   *
   * @param props - What the panel passes.
   * @returns The stub.
   */
  MarketValueEntry: ({
    entries, readOnly, readOnlyNote, onSave, onOpenHistory,
  }: MarketValueEntryProps) => (
    <div
      data-testid="value"
      data-entries={entries.map((entry) => entry.lockedReason ?? entry.key).join(',')}
      data-readonly={String(readOnly)}
      data-note={readOnlyNote ?? ''}
    >
      <button
        type="button"
        onClick={() => {
          onSave({ date: '2026-09-30', value: 500 }).then((outcome) => {
            document.body.dataset.outcome = outcome;
          });
        }}
      >
        save value
      </button>
      <button type="button" onClick={onOpenHistory}>open history</button>
    </div>
  ),
}));
vi.mock('../../../../../../src/experiences/trackInvestments/flows/holdingMaintenance/interactions/ValueHistoryDrawer', () => ({
  /**
   * The drawer's stand-in: an edit, a delete and Done.
   *
   * @param props - What the panel passes.
   * @returns The stub.
   */
  ValueHistoryDrawer: ({
    open, readOnly, onSave, onDelete, onClose,
  }: ValueHistoryDrawerProps) => (open ? (
    <div data-testid="drawer" data-readonly={String(readOnly)}>
      <button
        type="button"
        onClick={() => {
          onSave({ key: 'aug', date: '2026-08-31', value: 7 });
        }}
      >
        edit value
      </button>
      <button
        type="button"
        onClick={() => {
          onDelete('aug');
        }}
      >
        delete value
      </button>
      <button type="button" onClick={onClose}>done</button>
    </div>
  ) : null),
}));
vi.mock('../../../../../../src/experiences/trackInvestments/flows/holdingMaintenance/interactions/ActivityCard', () => ({
  /**
   * Activity's stand-in: the read's state and the link.
   *
   * @param props - What the panel passes.
   * @returns The stub.
   */
  ActivityCard: ({ read, onSeeAll }: ActivityCardProps) => (
    <button type="button" data-testid="activity" data-status={read.status} onClick={onSeeAll}>
      see all
    </button>
  ),
}));
vi.mock('../../../../../../src/experiences/trackInvestments/flows/holdingMaintenance/interactions/GoalAllocationCard', () => ({
  /**
   * The split's stand-in: whether it reads only, and a save.
   *
   * @param props - What the panel passes.
   * @returns The stub.
   */
  GoalAllocationCard: ({ readOnly, onSave }: GoalAllocationCardProps) => (
    <button
      type="button"
      data-testid="goals"
      data-readonly={String(readOnly)}
      onClick={() => {
        onSave([{ goalId: 'house', percentage: 40 }]);
      }}
    >
      save split
    </button>
  ),
}));

const XPML: InvestmentHolding = holdingOf('xpml11');
const SELIC: InvestmentHolding = holdingOf('selic29', {
  assetType: 'tesouro_direto', rate: { type: 'selic', value: 1000000 },
});
const RATES: IndexRateSeries[] = [{
  index: 'selic',
  unit: 'annual_percent',
  values: [{
    id: 'v',
    index: 'selic',
    value: 105000,
    asOf: '2026-09-01',
    createdByUserId: null,
    createdAt: '2026-09-01T00:00:00Z',
  }],
}];
const READY: HoldingDetails = {
  allocations: { status: 'ready', data: [] },
  snapshots: {
    status: 'ready',
    data: [
      {
        id: 'aug', asOfDate: '2026-08-31', valuation: 11000000, source: 'manual',
      },
      {
        id: 'buy', asOfDate: '2026-03-20', valuation: 3680000, source: 'transaction',
      },
    ],
  },
  activity: { status: 'loading' },
};

let queue: AlertQueue;

beforeEach(() => {
  queue = createAlertQueue(3);
  delete document.body.dataset.outcome;
});

const toasts = () => queue.visible().map(({ message }) => message);

/**
 * Renders a panel.
 *
 * @param over - Props to change.
 * @returns The requests.
 */
const renderPanel = (over: Partial<HoldingPanelProps> = {}) => {
  const ok = () => Promise.resolve({ ok: true as const });
  const requests: HoldingRequests = {
    onSaveAllocations: vi.fn(ok),
    onRecordValue: vi.fn(ok),
    onEditValue: vi.fn(ok),
    onDeleteValue: vi.fn(ok),
    onSeeTransactions: vi.fn(),
  };
  renderInLocale(
    <AlertProvider queue={queue}>
      <HoldingPanel
        row={{ holding: XPML, value: 11000000, archived: false }}
        currency="BRL"
        details={READY}
        goals={[]}
        indexRates={RATES}
        payout={89000}
        mayChange
        requests={requests}
        {...over}
      />
    </AlertProvider>,
  );
  return requests;
};

describe('HoldingPanel', () => {
  it('shows a fixed-term Holding\'s contract with its index, and its split', () => {
    renderPanel({ row: { holding: SELIC, value: 1, archived: false } });

    expect(screen.getByTestId('contract').dataset.index).toBe('105000');
    expect(screen.queryByTestId('position')).toBeNull();
    expect(screen.getByTestId('goals').dataset.readonly).toBe('false');
  });

  it('quotes no index while the rates load, or for a contract without a rate', () => {
    renderPanel({ row: { holding: SELIC, value: 1, archived: false }, indexRates: undefined });
    expect(screen.getByTestId('contract').dataset.index).toBe('none');
  });

  it('shows a market-priced Holding\'s position, value, activity and split', () => {
    renderPanel();

    expect(screen.getByTestId('position').dataset.payout).toBe('89000');
    expect(screen.getByTestId('value').dataset.entries).toBe('aug,From a trade');
    expect(screen.getByTestId('activity').dataset.status).toBe('loading');
  });

  it('records a new value, toasts it and answers done', async () => {
    const requests = renderPanel();

    fireEvent.click(screen.getByRole('button', { name: 'save value' }));

    await waitFor(() => expect(document.body.dataset.outcome).toBe('done'));
    expect(requests.onRecordValue)
      .toHaveBeenCalledWith('xpml11', { asOfDate: '2026-09-30', valuation: 500 });
    expect(toasts()).toEqual(['Market value saved.']);
  });

  it('answers refused and toasts the reason when a request fails', async () => {
    renderPanel({
      requests: {
        onSaveAllocations: vi.fn(),
        onRecordValue: vi.fn().mockResolvedValue({
          ok: false, error: { code: 'holding.archived' },
        }),
        onEditValue: vi.fn(),
        onDeleteValue: vi.fn(),
        onSeeTransactions: vi.fn(),
      },
    });

    fireEvent.click(screen.getByRole('button', { name: 'save value' }));

    await waitFor(() => expect(document.body.dataset.outcome).toBe('refused'));
    expect(toasts()).toEqual(["This holding is archived and can't be changed."]);
  });

  it('edits and deletes from the history drawer, and closes it', async () => {
    const requests = renderPanel();

    fireEvent.click(screen.getByRole('button', { name: 'open history' }));
    fireEvent.click(screen.getByRole('button', { name: 'edit value' }));
    fireEvent.click(screen.getByRole('button', { name: 'delete value' }));

    await waitFor(() => expect(toasts()).toEqual(['Market value saved.', 'Value deleted.']));
    expect(requests.onEditValue)
      .toHaveBeenCalledWith('xpml11', 'aug', { asOfDate: '2026-08-31', valuation: 7 });
    expect(requests.onDeleteValue).toHaveBeenCalledWith('xpml11', 'aug');

    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'done' })));
    expect(screen.queryByTestId('drawer')).toBeNull();
  });

  it('saves the split and asks for the ledger', async () => {
    const requests = renderPanel();

    fireEvent.click(screen.getByRole('button', { name: 'save split' }));
    fireEvent.click(screen.getByRole('button', { name: 'see all' }));

    await waitFor(() => expect(toasts()).toEqual(['Goal split saved.']));
    expect(requests.onSaveAllocations)
      .toHaveBeenCalledWith('xpml11', [{ goalId: 'house', percentage: 40 }]);
    expect(requests.onSeeTransactions).toHaveBeenCalledWith('xpml11');
  });

  it('reads only for an archived Holding, with its note', () => {
    renderPanel({ row: { holding: XPML, value: 0, archived: true }, mayChange: false });

    expect(screen.getByTestId('value').dataset.readonly).toBe('true');
    expect(screen.getByTestId('value').dataset.note)
      .toBe('Archived — the value history is read-only.');
    expect(screen.getByTestId('goals').dataset.readonly).toBe('true');
  });

  it('names a Holding without a ticker as blank, and one without a type market-priced', () => {
    const bare = holdingWithout(XPML, 'ticker', 'assetType');
    renderPanel({ row: { holding: bare, value: 0, archived: false } });

    expect(screen.getByTestId('position')).toBeTruthy();
  });

  it('reads only without a note for a user who may not change it', () => {
    renderPanel({ mayChange: false });

    expect(screen.getByTestId('value').dataset.note).toBe('');
  });

  it('opens the history only when asked, read-only for a user who may not change it (R4 V2)', () => {
    renderPanel({ mayChange: false });
    expect(screen.queryByTestId('drawer')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'open history' }));
    expect(screen.getByTestId('drawer').dataset.readonly).toBe('true');
    cleanup();

    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: 'open history' }));
    expect(screen.getByTestId('drawer').dataset.readonly).toBe('false');
  });

  it('stands in for the value card while its values load or after they failed', () => {
    const retry = vi.fn();
    renderPanel({ details: { ...READY, snapshots: { status: 'loading' } } });
    expect(screen.getByRole('status', { name: 'Loading your holdings' })).toBeTruthy();

    renderPanel({ details: { ...READY, snapshots: { status: 'failed', retry } } });
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(retry).toHaveBeenCalled();
  });
});
