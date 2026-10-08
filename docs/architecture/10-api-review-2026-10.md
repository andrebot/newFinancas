# API review — October 2026

Last review in the sequence (requirements ✅ → use cases ✅ → call chains ✅
→ sequences ✅ → data model ✅ → **API**). Applies the routes fixed in the
sequence review, the error envelope (OQ-83), notification types (OQ-82)
and the data model review's fields to `api/openapi.yaml` (**v1.1.0**),
then rebuilds `api/index.html`.

**Result:** 57 → **59 paths**, 76 → **82 operations**; validated with
`openapi-spec-validator`. Edits were applied programmatically through a
round-trip YAML loader that was first proven byte-identical on the
unchanged file, so nothing outside the intended changes moved.

## What changed

| Area | Change |
|---|---|
| Errors | `Error` = `{code, params, message (dev-only), details[{field, code, params}], correlationId}`; shared responses list their codes (OQ-83). |
| Goals | `/objectives*` → `/goals*`; `/complete`, `/reopen`; `Goal*` schemas; `completedAt`; `GET /goals?status=` returns `GoalWithProgress` (per-currency contributions + funded by). |
| Holdings | `assetType` enum (OQ-79), `rate.value` integer × 10,000, `incentivised`, `archivedBy`, `expectedPayout`, `expectedTaxes {estimated, amount}`. `PATCH /holdings/{id}` = allocations only. |
| Market values | `POST /holdings/{id}/valuation-snapshots`; `PATCH`/`DELETE …/{snapshotId}`; snapshot `source`, `accountTransactionId`. |
| Index rates | `GET /index-rates`; `POST /index-rates/{index}/values`; `PATCH`/`DELETE …/{valueId}`. |
| Transactions | `GET /transactions` merges both ledgers (`ledger` discriminator), filters incl. `holdingId`, `from`/`to`, **cursor** pagination, `dayTotals`. Recurring endpoints + schema removed; `source` = `manual`/`schedule`; `incentivised` on create. |
| Reports | `GET /reports/{reportType}` v1 types `month-overview`, `investments-overview`, `payouts` (discriminated response). Export marked `x-deferred: v2`. |
| Dashboard | `GET /dashboard` = fixed panels; `PATCH /dashboard/widgets` `x-deferred: v3`. |
| Notifications | `Notification` = discriminated union by `type` (`invitation.received`, `holding.matured`), `params`, no `message`. |
| Identity | `User.preferences {theme, language}`; `PATCH /users/me` preferences; `DELETE /users/me/sessions`; password-reset email via `NotificationDeliveryUtility` (OQ-84). |
| Accounts / Categories | 4 account types; category `icon` + `color` (18 palette tokens). |

## Allocation percentage (OQ-87)

- Was a JSON `number` (float). First converted to basis points under
  the "avoid float issues" rule; on review the stakeholder chose
  **whole-percent integers (1–100)** — basis points had no real use case.
  API, data model and ERD aligned.

## Not changed (noted)

- Other lists keep `limit`/`offset`; only the transaction list needed a
  cursor (new rows arriving while scrolling).
- `03-api-design.md` updated to match (error envelope, cursor pagination,
  whole-percent allocations, removed recurring, v1 reports, new endpoints).
