# Leaderboard Contract

## Purpose

Define the only public persistence operations used by Neon Barrage. The browser uses
the Supabase public anonymous key; no service-role or management credential is part of
this contract.

## Read Top Entries

**Operation**: list the public leaderboard.

**Request**: no body. The client asks for the first page only.

**Response**: an array of entries containing `name`, `score`, and `created_at`.

**Ordering**: `score` descending, then `created_at` ascending, then `id` ascending
for a deterministic tie. The response is limited to 10 entries.

**States**:

- Loading shows a non-blocking loading state.
- An empty array shows an explicit empty state.
- A network or permission error shows an actionable error and Retry control.
- A successful response never exposes fields that are not needed by the public list.

## Create Entry

**Operation**: create one leaderboard entry after game over.

**Request body**:

```json
{
  "name": "PLAYER",
  "score": 1234
}
```

**Client checks**: trim the name, reject blank, overlong, or control-character
content, and require a non-negative integer within the permitted range.

**Database checks**: repeat the name and score checks in table constraints. The
database rejects forged or malformed requests even when the browser is bypassed.

**Response**: the accepted entry or a structured error mapped to a user-safe message.
The client refreshes the top-10 list after success.

## Forbidden Operations

The public role has no update, delete, schema, policy, or administrative operation.
The test adapter cannot call this operation directly; it only reaches the same
game-over form and Submit control as a normal player.

## Security Contract

- RLS is enabled on every table in the exposed schema.
- Public grants are limited to selecting rows and inserting `name` and `score`.
- `id` and `created_at` are server-managed.
- Service-role and management credentials never appear in browser assets, logs, or
  user-visible error text.
