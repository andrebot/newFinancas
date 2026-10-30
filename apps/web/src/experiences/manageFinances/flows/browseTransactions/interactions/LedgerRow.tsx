import type { LedgerItem } from '@financas/api-types';
import { InlineBanner } from '../../../../../kit/alert/InlineBanner';
import { Amount } from '../../../../../kit/amount/Amount';
import { Button } from '../../../../../kit/button/Button';
import { CategoryDisc } from '../../../../../kit/categoryChip/CategoryChip';
import { InlineConfirm } from '../../../../../kit/confirm/InlineConfirm';
import { Expandable } from '../../../../../kit/expandable/Expandable';
import { KeyValueList } from '../../../../../kit/keyValueList/KeyValueList';
import { ListRowIcon } from '../../../../../kit/listRow/ListRowIcon';
import { Tag } from '../../../../../kit/tag/Tag';
import { useI18n } from '../../../../../utilities/I18nProvider';
import useFormatter from '../../../../../utilities/useFormatter';
import { browseText } from '../browseText';
import {
  rowDetailsOf, rowIconOf, rowMetaOf, rowTitleOf, signedAmountOf,
  type LedgerLookup, type RowAccess,
} from '../ledgerRow';

// Expanded Row and Delete Confirm (FL16, mockups 30, 34; OQ-220): one ledger
// row — its category's disc (or its kind's glyph), title, meta line and
// signed amount — that opens on a click to its details and, when the user may
// change it, Edit and Delete; Delete asks first, in the row. A row on an
// archived account says so instead. It renders and emits: the Flow holds
// which row is open and runs the delete; Edit is a request the Experience
// answers by opening Record Transaction.

/** LedgerRow's props. */
export interface LedgerRowProps {
  readonly item: LedgerItem;
  readonly lookup: LedgerLookup;
  /** What the open row offers. */
  readonly access: RowAccess;
  readonly expanded: boolean;
  readonly onExpandedChange: (expanded: boolean) => void;
  /** Whether the delete confirm shows. */
  readonly confirming: boolean;
  /** Whether the delete is out. */
  readonly deleting: boolean;
  /** Why the last delete failed, already translated. */
  readonly failure?: string | undefined;
  readonly onEdit: () => void;
  readonly onDelete: () => void;
  readonly onConfirmDelete: () => void;
  readonly onCancelDelete: () => void;
}

/**
 * Renders the row's leading icon.
 *
 * @param props - The row and the lookup.
 * @returns Its category's disc, or its kind's glyph.
 */
function RowGlyph({ item, lookup }: Pick<LedgerRowProps, 'item' | 'lookup'>) {
  const icon = rowIconOf(item, lookup);
  if ('category' in icon) {
    return <CategoryDisc icon={icon.category.icon} color={icon.category.color} size="md" />;
  }
  return <ListRowIcon icon={icon.kind} />;
}

/**
 * Renders the row's summary: icon, title, meta line and amount.
 *
 * @param props - The row and the lookup.
 * @returns The summary.
 */
function RowSummary({ item, lookup }: Pick<LedgerRowProps, 'item' | 'lookup'>) {
  const translator = useI18n();
  return (
    <span className="flex items-center gap-3">
      <RowGlyph item={item} lookup={lookup} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-medium text-ink">{rowTitleOf(item, translator)}</span>
        <span className="truncate type-caption text-muted">
          {rowMetaOf(item, lookup, translator)}
        </span>
      </span>
      <Amount
        amount={signedAmountOf(item)}
        currency={item.currency ?? 'BRL'}
        tone="signed"
        className="shrink-0 font-semibold"
      />
    </span>
  );
}

/**
 * Renders what the open row offers: Edit and Delete, the archived note, or nothing.
 *
 * @param props - The access and the handlers.
 * @returns The actions.
 */
function RowActions({
  access, onEdit, onDelete,
}: Pick<LedgerRowProps, 'access' | 'onEdit' | 'onDelete'>) {
  const translator = useI18n();
  if (access === 'archived') {
    return <p className="type-caption text-muted">{browseText(translator, 'archivedNote')}</p>;
  }
  if (access === 'none') return null;
  return (
    <div className="flex shrink-0 gap-2">
      <Button variant="secondary" size="md" leadingIcon="edit-outline" onClick={onEdit}>
        {browseText(translator, 'edit')}
      </Button>
      <Button variant="danger-ghost" size="md" leadingIcon="delete-outline" onClick={onDelete}>
        {browseText(translator, 'delete')}
      </Button>
    </div>
  );
}

/**
 * Renders the delete confirm, with the last failure above it.
 *
 * @param props - The request's state and the handlers.
 * @returns The confirm.
 */
function DeleteConfirm({
  deleting, failure, onConfirmDelete, onCancelDelete,
}: Pick<LedgerRowProps, 'deleting' | 'failure' | 'onConfirmDelete' | 'onCancelDelete'>) {
  const translator = useI18n();
  return (
    <div className="flex flex-col gap-2">
      {failure && <InlineBanner tone="error" message={failure} />}
      <InlineConfirm
        tone="destructive"
        message={browseText(translator, 'delete.message')}
        confirmLabel={browseText(translator, 'delete.confirm')}
        cancelLabel={browseText(translator, 'delete.cancel')}
        onConfirm={onConfirmDelete}
        onCancel={onCancelDelete}
        busy={deleting}
      />
    </div>
  );
}

/**
 * Renders the row: its summary and, while open, its details and actions.
 *
 * @param props - The row, the lookup, its access, open and delete states and the handlers.
 * @returns The row.
 */
export function LedgerRow(props: LedgerRowProps) {
  const {
    item, lookup, expanded, onExpandedChange, confirming,
  } = props;
  const translator = useI18n();
  const formatter = useFormatter();
  return (
    <Expandable
      summary={<RowSummary item={item} lookup={lookup} />}
      expanded={expanded}
      onExpandedChange={onExpandedChange}
    >
      <div className="flex flex-col gap-3 pb-4 pl-17 pr-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-2">
            <KeyValueList
              items={rowDetailsOf(item, lookup, translator, formatter)}
              columns={3}
              emptyLabel={browseText(translator, 'detail.empty')}
            />
            {item.ledger === 'account' && item.source === 'schedule' && (
              <Tag size="micro">{browseText(translator, 'scheduled')}</Tag>
            )}
          </div>
          {!confirming && <RowActions {...props} />}
        </div>
        {confirming && <DeleteConfirm {...props} />}
      </div>
    </Expandable>
  );
}
