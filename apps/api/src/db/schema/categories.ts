import { pgTable, text, uuid } from 'drizzle-orm/pg-core';
import {
  CASCADE, createdAt, id, instant,
} from './columns';
import { households } from './identity';

// Categories (02-data-model.md) — CategoryAccessor. Archive-only, never deleted
// (FR-10.3); exactly two levels, structurally (FR-10.2).

export const categories = pgTable('categories', {
  id: id(),
  householdId: uuid('household_id').notNull().references(() => households.id, CASCADE),
  name: text('name').notNull(),
  icon: text('icon').notNull(),
  // One of the 18 palette tokens (OQ-85), validated in code.
  color: text('color').notNull(),
  archivedAt: instant('archived_at'),
  createdAt: createdAt(),
});

export const subcategories = pgTable('subcategories', {
  id: id(),
  categoryId: uuid('category_id').notNull().references(() => categories.id, CASCADE),
  name: text('name').notNull(),
  archivedAt: instant('archived_at'),
  createdAt: createdAt(),
});
