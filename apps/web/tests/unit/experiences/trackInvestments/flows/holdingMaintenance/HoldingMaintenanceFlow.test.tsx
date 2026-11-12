import { fireEvent, screen } from '@testing-library/react';
import {
  describe, expect, it, vi,
} from 'vitest';
import {
  HoldingMaintenanceFlow, type HoldingMaintenanceFlowProps,
} from '../../../../../../src/experiences/trackInvestments/flows/holdingMaintenance/HoldingMaintenanceFlow';
import type { HoldingDetails, HoldingPanelProps } from '../../../../../../src/experiences/trackInvestments/flows/holdingMaintenance/HoldingPanel';
import type { AccountPickerProps } from '../../../../../../src/experiences/trackInvestments/flows/holdingMaintenance/interactions/AccountPicker';
import type { HoldingsTableProps } from '../../../../../../src/experiences/trackInvestments/flows/holdingMaintenance/interactions/HoldingsTable';
import { renderInLocale } from '../../../../../support/renderInLocale';
import { HOLDINGS, INVESTMENT_ACCOUNTS, OVERVIEW } from '../../../portfolioFixtures';

// The Holding Maintenance Flow (BDT: Flow, unit). Its Interactions and the
// open row's panel are stubbed — they have their own suites — so the Flow is
// tested on what it hands each one in the overview's three states, the empty
// household, the account chosen, and the details slot it renders the panel
// through. The Experience's reads and requests are the props it is handed;
// the translator and the kit stay real.

vi.mock('../../../../../../src/experiences/trackInvestments/flows/holdingMaintenance/interactions/AccountPicker', () => ({
  /**
   * The picker's stand-in: one button per card, the chosen one marked.
   *
   * @param props - What the Flow passes.
   * @returns The stub.
   */
  AccountPicker: ({ cards, selectedId, onSelect }: AccountPickerProps) => (
    <div data-testid="picker" data-selected={selectedId}>
      {cards.map(({ account }) => (
        <button key={account.id} type="button" onClick={() => onSelect(account.id)}>
          {account.name}
        </button>
      ))}
    </div>
  ),
}));
vi.mock('../../../../../../src/experiences/trackInvestments/flows/holdingMaintenance/interactions/HoldingsTable', () => ({
  /**
   * The table's stand-in: the account, its groups, and every row's panel.
   *
   * @param props - What the Flow passes.
   * @returns The stub.
   */
  HoldingsTable: ({
    accountName, currency, groups, wide, renderPanel, openHoldingId,
  }: HoldingsTableProps) => (
    <div
      data-testid="table"
      data-open={openHoldingId}
      data-account={accountName}
      data-currency={currency}
      data-wide={String(wide)}
      data-groups={groups.map((group) => `${group.kind}:${group.rows.length}`).join(',')}
    >
      {groups.flatMap((group) => group.rows).map((row) => (
        <div key={row.holding.id}>{renderPanel(row)}</div>
      ))}
    </div>
  ),
}));
vi.mock('../../../../../../src/experiences/trackInvestments/flows/holdingMaintenance/HoldingPanel', () => ({
  /**
   * The panel's stand-in: what it was handed.
   *
   * @param props - What the Flow passes.
   * @returns The stub.
   */
  HoldingPanel: ({
    row, details, payout, mayChange,
  }: HoldingPanelProps) => (
    <p
      data-testid={`panel-${row.holding.id}`}
      data-payout={payout}
      data-may-change={String(mayChange)}
      data-details={details.allocations.status}
    />
  ),
}));

const DETAILS: HoldingDetails = {
  allocations: { status: 'loading' },
  snapshots: { status: 'loading' },
  activity: { status: 'loading' },
};

/**
 * Renders the Flow.
 *
 * @param over - Props to change.
 * @returns The props.
 */
const renderFlow = (over: Partial<HoldingMaintenanceFlowProps> = {}) => {
  const props: HoldingMaintenanceFlowProps = {
    overview: { status: 'loaded', report: OVERVIEW, holdings: HOLDINGS },
    onRetry: vi.fn(),
    accounts: INVESTMENT_ACCOUNTS,
    goals: [],
    indexRates: undefined,
    viewer: { selfUserId: 'ana', role: 'Owner' },
    details: vi.fn((_, render) => render(DETAILS)),
    requests: {
      onSaveAllocations: vi.fn(),
      onRecordValue: vi.fn(),
      onEditValue: vi.fn(),
      onDeleteValue: vi.fn(),
      onSeeTransactions: vi.fn(),
    },
    ...over,
  };
  renderInLocale(<HoldingMaintenanceFlow {...props} />);
  return props;
};

describe('HoldingMaintenanceFlow', () => {
  it('opens on the first account, its Holdings grouped, every column on a wide screen', () => {
    renderFlow();

    expect(screen.getByTestId('picker').dataset.selected).toBe('xp');
    const table = screen.getByTestId('table');
    expect(table.dataset.account).toBe('XP Investimentos');
    expect(table.dataset.currency).toBe('BRL');
    expect(table.dataset.wide).toBe('true');
    expect(table.dataset.groups).toBe('fixedIncome:1,variableIncome:4');
  });

  it('renders each open row through the details slot, with its payout and the rule', () => {
    const props = renderFlow();

    expect(props.details).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'xpml11' }),
      expect.any(Function),
    );
    const panel = screen.getByTestId('panel-xpml11');
    expect(panel.dataset.payout).toBe('89000');
    expect(panel.dataset.mayChange).toBe('true');
    expect(panel.dataset.details).toBe('loading');
    expect(screen.getByTestId('panel-old11').dataset.mayChange).toBe('false');
  });

  it('switches to the account chosen', () => {
    renderFlow();

    fireEvent.click(screen.getByRole('button', { name: 'Main Checking' }));

    expect(screen.getByTestId('picker').dataset.selected).toBe('checking');
    expect(screen.getByTestId('table').dataset.currency).toBe('USD');
    expect(screen.getByTestId('table').dataset.groups).toBe('variableIncome:2');
  });

  it('opens on a linked Holding: its account chosen, its row open (OQ-243)', () => {
    renderFlow({ openHoldingId: 'msft' });

    expect(screen.getByTestId('picker').dataset.selected).toBe('checking');
    expect(screen.getByTestId('table').dataset.open).toBe('msft');
  });

  it('opens on the first account when the linked Holding isn\'t the household\'s', () => {
    renderFlow({ openHoldingId: 'elsewhere' });

    expect(screen.getByTestId('picker').dataset.selected).toBe('xp');
    expect(screen.getByTestId('table').dataset.open).toBe('elsewhere');
  });

  it('lets a Viewer only read', () => {
    renderFlow({ viewer: { selfUserId: 'ana', role: 'Viewer' } });

    expect(screen.getByTestId('panel-xpml11').dataset.mayChange).toBe('false');
  });

  it('shows placeholders while the overview loads', () => {
    renderFlow({ overview: { status: 'loading' } });

    expect(screen.getByRole('status', { name: 'Loading your holdings' })).toBeTruthy();
    expect(screen.queryByTestId('table')).toBeNull();
  });

  it('shows a failure with Try again', () => {
    const props = renderFlow({ overview: { status: 'failed' } });

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(screen.getByText("Couldn't load your holdings.")).toBeTruthy();
    expect(props.onRetry).toHaveBeenCalled();
  });

  it('shows one empty state to a household with no Holding', () => {
    renderFlow({ overview: { status: 'loaded', report: OVERVIEW, holdings: [] } });

    expect(screen.getByText('No investments yet')).toBeTruthy();
    expect(screen.queryByTestId('picker')).toBeNull();
  });
});
