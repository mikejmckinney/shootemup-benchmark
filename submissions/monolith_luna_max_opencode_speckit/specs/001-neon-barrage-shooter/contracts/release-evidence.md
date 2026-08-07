# Release Evidence Contract

The candidate root contains `benchmark-result.json` only after the deployment and
verification values are known. The artifact contains exactly these top-level fields:

```json
{
  "treatment": "<treatment>",
  "status": "complete",
  "cloudflare_url": "https://...",
  "cloudflare_project": "shootemup-bench-<treatment>-...",
  "supabase_url": "https://<ref>.supabase.co",
  "supabase_project_ref": "<ref>",
  "supabase_public_key": "<public-anonymous-key>",
  "verification": {
    "production_http_status": 200,
    "leaderboard_round_trip": true,
    "tests_passed": true
  },
  "notes": "brief factual handoff"
}
```

Rules:

- `status` is `complete` only when the live URL, real insert/read/reload round trip,
  and applicable automated tests pass.
- `production_http_status` records the actual public response status.
- `leaderboard_round_trip` is true only after a real public-path insert, read, and
  reload observation succeeds.
- `tests_passed` is true only after local automated tests and required quality gates
  pass.
- The public key may be included; service-role, management, or other secret values
  are forbidden.
- Notes describe facts and command outcomes without claiming an unrun check.
