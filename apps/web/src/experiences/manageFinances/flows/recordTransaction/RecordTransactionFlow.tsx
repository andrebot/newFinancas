import type { Account, Category } from '@financas/api-types';
import { InlineBanner } from '../../../../kit/alert/InlineBanner';
import { Button } from '../../../../kit/button/Button';
import { Drawer } from '../../../../kit/drawer/Drawer';
import { useI18n } from '../../../../utilities/I18nProvider';
import type { Translator } from '../../../../utilities/i18n';
import useFormatter from '../../../../utilities/useFormatter';
import { isoDate } from '../../../../utilities/validation';
import {
  awaitsSchedule, editableNow,
  type EditedTransaction, type RecordTransactionState, type SplitGoal,
} from './recordTransactionState';
import { recordText } from './recordText';
import { problemText, type CheckedField } from './transactionChecks';
import {
  currencyOf, groupOf, isBuy, isTrade, namesHolding, withAccount, withAllocations, withCard,
  withCategory, withGroup, withHolding, withKind,
} from './transactionForm';
import useRecordTransaction, {
  type RecordTransactionController, type RecordTransactionRequests,
} from './useRecordTransaction';
import { GoalAllocationEntry } from './interactions/GoalAllocationEntry';
import { HoldingSelection } from './interactions/HoldingSelection';
import { InvestmentBuyEntry } from './interactions/InvestmentBuyEntry';
import { KindSelection } from './interactions/KindSelection';
import {
  AmountField, CategoryFields, DetailFields, TargetFields,
} from './interactions/TransactionEntry';

// The Record Transaction Flow (FL15, mockups 31, 32, 35; FR-3.1, FR-3.2,
// OQ-201, OQ-206, OQ-219): one drawer for every kind — pick the group and the
// kind, then what that kind needs — and for editing a ledger row, its kind and
// target shown, never changed. A sell or redemption carries its Holding's
// split, pre-filled; a fixed-term buy's edit keeps its amount, date and terms
// once its schedule has started (D8). The Flow holds the form and what it
// asked to read; the Manage Finances Experience reads and writes — an
// account's Holdings, a Holding's split and schedule, the record and the save
// — and, once the drawer closes after a success, refreshes the ledger and the
// Month Overview (EBD: no Flow talks to a sibling). A success is toasted; a
// failure shows in the drawer's banner. It never calls the backend.

/** What the Flow asks of the Experience. */
export interface RecordTransactionFlowProps extends RecordTransactionRequests {
  /** The row an edit is about; a new transaction has none. */
  readonly transaction?: EditedTransaction | undefined;
  /** The accounts the user can see, archived ones included, with their cards. */
  readonly accounts: readonly Account[];
  /** The household's categories, archived ones included. */
  readonly categories: readonly Category[];
  /** The Goals the user can see, with their progress, for a trade's split. */
  readonly goals: readonly SplitGoal[];
}

/** The fields a kind or group change clears: every refusal goes. */
const EVERY_FIELD: readonly CheckedField[] = [
  'account', 'card', 'amount', 'date', 'holding', 'quantity', 'assetType', 'ticker', 'rateValue',
  'dueDate', 'allocations',
];

/** What every section works with: the controller and the accounts. */
interface SectionProps {
  readonly controller: RecordTransactionController;
  readonly accounts: readonly Account[];
}

/**
 * Writes a field's refusal from the last submit.
 *
 * @param controller - The Flow's controller.
 * @param field - The field.
 * @param translator - The texts.
 * @returns Its message, or nothing.
 */
const refusalOf = (
  controller: RecordTransactionController,
  field: CheckedField,
  translator: Translator,
) => problemText(controller.state.problems[field], translator);

/**
 * Names the Holding an edit is about, from its ledger row.
 *
 * @param transaction - The row an edit is about, if any.
 * @returns Its ticker on an edit; nothing for a new transaction.
 */
const lockedHoldingNameOf = (transaction: EditedTransaction | undefined) => {
  if (transaction === undefined) return undefined;
  const { item } = transaction;
  return item.ledger === 'account' ? item.holding?.ticker ?? '' : '';
};

/**
 * Renders the footer's note: the month the transaction lands in, once its date is real.
 *
 * @param props - The date.
 * @returns The note, or nothing.
 */
function LandsIn({ date }: { readonly date: string }) {
  const translator = useI18n();
  const formatter = useFormatter();
  if (date === '' || isoDate()(date)) return <span className="mr-auto" />;
  return (
    <span className="mr-auto type-caption text-muted">
      {recordText(translator, 'landsIn')}
      {' '}
      <span className="font-semibold text-mint">{formatter.date(date, 'monthYear')}</span>
    </span>
  );
}

/**
 * Renders a buy's asset, contract and units.
 *
 * @param props - The controller and the accounts.
 * @returns The buy's section.
 */
function BuySection({ controller, accounts }: SectionProps) {
  const translator = useI18n();
  const { state, change } = controller;
  const { form } = state;
  const refusal = (field: CheckedField) => refusalOf(controller, field, translator);
  return (
    <InvestmentBuyEntry
      form={form}
      currency={currencyOf(form, accounts)}
      editable={state.original ? editableNow(state) : undefined}
      errors={{
        assetType: refusal('assetType'),
        ticker: refusal('ticker'),
        quantity: refusal('quantity'),
        rateValue: refusal('rateValue'),
        dueDate: refusal('dueDate'),
      }}
      onAsset={(asset) => change({ ...form, ...asset }, ['assetType', 'ticker'])}
      onQuantity={(quantity) => change({ ...form, quantity }, ['quantity'])}
      onTerms={(terms) => change({ ...form, terms }, ['rateValue', 'dueDate'])}
    />
  );
}

/**
 * Renders the Holding the other investment kinds pick, with a trade's units.
 *
 * @param props - The controller, the accounts and the edit's Holding name.
 * @returns The Holding's section.
 */
function HoldingSection({ controller, accounts, lockedName }: SectionProps & {
  readonly lockedName: string | undefined;
}) {
  const translator = useI18n();
  const { state, change } = controller;
  const { form } = state;
  return (
    <HoldingSelection
      kind={form.kind}
      holdings={form.accountId === undefined ? undefined : state.holdings[form.accountId]}
      currency={currencyOf(form, accounts)}
      holdingId={form.holdingId}
      quantity={form.quantity}
      holdingError={refusalOf(controller, 'holding', translator)}
      quantityError={refusalOf(controller, 'quantity', translator)}
      lockedName={lockedName}
      onHolding={(holding) => change(withHolding(form, holding), ['holding', 'quantity'])}
      onQuantity={(quantity) => change({ ...form, quantity }, ['quantity'])}
      onRetry={controller.retryHoldings}
    />
  );
}

/**
 * Tells which split a new trade shows: a buy's purchase, or — once a Holding
 * is picked — a sell's or redemption's Holding split. An edit shows none.
 *
 * @param state - The Flow's state.
 * @returns Where the split comes from, or nothing when none shows.
 */
const splitSourceOf = (state: RecordTransactionState) => {
  const { form } = state;
  if (state.original || !isTrade(form.kind)) return undefined;
  if (isBuy(form.kind)) return 'purchase';
  return form.holdingId === undefined ? undefined : 'holding';
};

/**
 * Renders a new trade's Goal split: a buy's purchase, a sell's or redemption's
 * Holding split once a Holding is picked. An edit never changes it (OQ-201 D6).
 *
 * @param props - The controller and the Goals.
 * @returns The split, or nothing.
 */
function SplitSection({ controller, goals }: {
  readonly controller: RecordTransactionController;
  readonly goals: readonly SplitGoal[];
}) {
  const translator = useI18n();
  const { state, change } = controller;
  const { form } = state;
  const source = splitSourceOf(state);
  if (source === undefined) return null;
  return (
    <GoalAllocationEntry
      source={source}
      rows={form.allocations}
      goals={goals.filter((goal) => !goal.completed)}
      load={source === 'holding' ? state.split?.load : undefined}
      showErrors={state.refusals > 0}
      error={refusalOf(controller, 'allocations', translator)}
      onChange={(rows) => change(withAllocations(form, rows), ['allocations'])}
      onRetry={controller.retrySplit}
    />
  );
}

/**
 * Renders the category and subcategory, for every kind (OQ-201 D4).
 *
 * @param props - The controller and the categories.
 * @returns The category fields.
 */
function CategorySection({ controller, categories }: {
  readonly controller: RecordTransactionController;
  readonly categories: readonly Category[];
}) {
  const { state, change } = controller;
  const { form } = state;
  return (
    <CategoryFields
      categories={categories}
      categoryId={form.categoryId}
      subcategoryId={form.subcategoryId}
      investment={groupOf(form.kind) === 'investment'}
      onCategory={(categoryId) => change(withCategory(form, categoryId), [])}
      onSubcategory={(subcategoryId) => change({ ...form, subcategoryId }, [])}
    />
  );
}

/**
 * Renders the kind, the amount and the target — the drawer's top, every kind's.
 *
 * @param props - The controller and the accounts.
 * @returns The top sections.
 */
function EntryTop({ controller, accounts }: SectionProps) {
  const translator = useI18n();
  const { state, change } = controller;
  const { form } = state;
  const editing = state.original !== undefined;
  const fixed = editing && !editableNow(state).amountAndDate;
  return (
    <>
      <KindSelection
        kind={form.kind}
        locked={editing}
        onGroupChange={(group) => change(withGroup(form, group, accounts), EVERY_FIELD)}
        onKindChange={(kind) => change(withKind(form, kind, accounts), EVERY_FIELD)}
      />
      <AmountField
        form={form}
        currency={currencyOf(form, accounts)}
        error={refusalOf(controller, 'amount', translator)}
        disabled={fixed}
        onChange={(amount) => change({ ...form, amount }, ['amount'])}
      />
      <TargetFields
        form={form}
        accounts={accounts}
        accountError={refusalOf(controller, 'account', translator)}
        cardError={refusalOf(controller, 'card', translator)}
        locked={editing}
        onAccount={(account) => change(
          withAccount(form, account, accounts),
          ['account', 'holding', 'quantity', 'assetType'],
        )}
        onCard={(cardId) => change(withCard(form, cardId, accounts), ['card', 'account'])}
      />
    </>
  );
}

/**
 * Renders the date and description; a started schedule keeps the date (D8).
 *
 * @param props - The controller.
 * @returns The details.
 */
function DetailSection({ controller }: { readonly controller: RecordTransactionController }) {
  const translator = useI18n();
  const { state, change } = controller;
  const { form } = state;
  return (
    <DetailFields
      date={form.date}
      description={form.description}
      dateError={refusalOf(controller, 'date', translator)}
      dateDisabled={state.original !== undefined && !editableNow(state).amountAndDate}
      onDate={(date) => change({ ...form, date }, ['date', 'dueDate'])}
      onDescription={(description) => change({ ...form, description }, [])}
    />
  );
}

/**
 * Renders the banners: the last request's failure, and an edit whose schedule
 * has started (D8).
 *
 * @param props - The controller.
 * @returns The banners.
 */
function Banners({ controller }: { readonly controller: RecordTransactionController }) {
  const translator = useI18n();
  const { state } = controller;
  const started = state.original !== undefined && !editableNow(state).amountAndDate;
  return (
    <>
      {state.lastError && (
        <InlineBanner
          tone="error"
          message={translator.error(state.lastError.code, state.lastError.params)}
        />
      )}
      {started && (
        <InlineBanner tone="info" message={recordText(translator, 'scheduleStarted')} />
      )}
    </>
  );
}

/**
 * Renders the record drawer, holds its form and runs its reads and its write.
 *
 * @param props - The edited row, the lists, and the Experience's reads, writes and close.
 * @returns The drawer.
 */
export function RecordTransactionFlow(props: RecordTransactionFlowProps) {
  const {
    transaction, accounts, categories, goals, onClose,
  } = props;
  const translator = useI18n();
  const controller = useRecordTransaction(props);
  const { state } = controller;
  const { form } = state;
  const mode = state.original ? 'edit' : 'record';
  const investment = groupOf(form.kind) === 'investment';
  const categorySection = <CategorySection controller={controller} categories={categories} />;

  /** Closes the drawer on Esc, the scrim or the ✕ — not while the request is out. */
  const close = () => {
    if (!state.out) onClose();
  };

  return (
    <Drawer
      open
      onClose={close}
      caption={recordText(translator, `${mode}.caption`)}
      title={recordText(translator, `${mode}.title`)}
      footer={(
        <>
          <LandsIn date={form.date} />
          <Button variant="secondary" disabled={state.out} onClick={onClose}>
            {recordText(translator, 'cancel')}
          </Button>
          <Button
            variant="primary"
            busy={state.out}
            disabled={awaitsSchedule(state)}
            onClick={controller.submit}
          >
            {recordText(translator, `${mode}.submit`)}
          </Button>
        </>
      )}
    >
      <div className="flex flex-col gap-5">
        <Banners controller={controller} />
        <EntryTop controller={controller} accounts={accounts} />
        {isBuy(form.kind) && <BuySection controller={controller} accounts={accounts} />}
        {namesHolding(form.kind) && (
          <HoldingSection
            controller={controller}
            accounts={accounts}
            lockedName={lockedHoldingNameOf(transaction)}
          />
        )}
        {!investment && categorySection}
        <DetailSection controller={controller} />
        {investment && categorySection}
        <SplitSection controller={controller} goals={goals} />
      </div>
    </Drawer>
  );
}
