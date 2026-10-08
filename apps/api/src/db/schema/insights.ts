import {
  index, jsonb, pgTable, text, uuid,
} from 'drizzle-orm/pg-core';
import {
  CASCADE, createdAt, id, instant,
} from './columns';
import { users } from './identity';

// Insights (02-data-model.md) — NotificationInboxAccessor, AuditLogAccessor.
// `dashboard_widgets` is parked until v3 (OQ-67) and not created.

export const notifications = pgTable('notifications', {
  id: id(),
  userId: uuid('user_id').notNull().references(() => users.id, CASCADE),
  type: text('type').notNull(),
  // Type + raw parameters, never display text (OQ-82).
  params: jsonb('params').notNull().default({}),
  seenAt: instant('seen_at'),
  createdAt: createdAt(),
}, (t) => [
  index('notifications_inbox_idx').on(t.userId, t.seenAt),
]);

// Append-only (NFR-AUD-1): the application role may only SELECT and INSERT
// (grants migration). No foreign keys by design — IDs stay as orphan-tolerant values.
export const auditLogEntries = pgTable('audit_log_entries', {
  id: id(),
  actorId: uuid('actor_id'),
  householdId: uuid('household_id'),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: uuid('entity_id').notNull(),
  createdAt: createdAt(),
}, (t) => [
  index('audit_log_entries_export_idx').on(t.householdId, t.createdAt),
]);
