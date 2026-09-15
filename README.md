# Trip Expense Tracker

A React + Express + MongoDB app for personal payments, direct debts between travelers, and a separate group purse. The original design prototype remains in `prototype/`.

## Task status — September 15, 2026

| Stage | Status |
| --- | --- |
| UI prototype | Completed in the earlier task |
| MongoDB connection | Verified with the configured Atlas database |
| Models and access rules | Repaired and tested; personal expenses and purse entries use separate collections |
| Traveler identity and trip codes | Working browser sessions, create/join, and membership checks |
| Expense API and retry protection | Working for personal payments, contributions, and lead-only spending |
| Settlement calculations | Direct pairwise offsets with integer paise and deterministic remainder allocation |
| React integration | Working onboarding, overview, personal pocket, balances, group purse, and unified Add expense |
| Real-time updates | Pending; the unsafe unauthenticated socket broadcast was removed; use Refresh trip |
| Offline queue and installable PWA | Pending; saves currently require connectivity |
| Public deployment and account recovery | Pending |

### Bugs repaired

- API models had replaced the earlier schema contract, breaking `createModels` and all existing tests.
- Settlement ignored personal payments and could incorrectly treat group-purse spending as money owed to a lead.
- Joining and expense writes trusted client-supplied identities; every frontend user used one dummy ID.
- Expense retries created duplicates, and purse spending could race or reduce the balance before an expense was saved.
- Socket rooms admitted anyone and broadcast private expenses.
- Frontend styling referenced Tailwind without configuring it, producing an effectively unstyled build.
- React and React DOM were not declared as direct frontend dependencies.

## Run the connected app

Requires Node.js 22.15+ and a MongoDB replica set (Atlas works). Purse writes use transactions.

```powershell
npm ci
npm --prefix client ci
```

Put `MONGODB_URI` and optionally `MONGODB_DB_NAME` in the root `.env`, using `.env.example` as a guide. The server reads the root `.env`; `server/.env` is not used. Credentials remain ignored by Git.

```powershell
npm run db:check
npm run build
npm run dev
```

Open [the local app](http://127.0.0.1:5000/). The server serves the built React app and API on the same origin. It listens only on localhost. Startup creates the required indexes; failures stop startup.

For React hot reload, keep the API running and run `npm run dev:client` in another terminal. Vite proxies `/api` to port 5000. For the old in-memory UI prototype, run `npm run dev:prototype`.

## Current behavior

- Each browser creates a distinct traveler session; the server stores only its token hash. Requests derive the payer from that session, never a client-supplied user ID.
- Session and active-trip selection survive refresh. Sessions are browser-bound bearer credentials, with no password, expiry, cross-device recovery, or verified identity yet. Clearing browser storage loses access to that identity. This is a development milestone, not a public account system.
- Travelers record their own payments for themselves, friends, or any selected combination. A payer need not be a beneficiary.
- Money uses integer paise. Splits distribute remainder paise in selected beneficiary order. Direct debts offset only payments between the same pair.
- Self-only expenses are hidden from everyone else, including leads. Other shared personal payments and direct balances are visible to trip members.
- **Contribution to group purse** remains inside **Add expense**. Members see only their own contributions; leads see all purse entries and its balance.
- Only leads spend from the purse. The purse starts at zero and is funded by contributions. Purse entries never change personal debts.
- Purse balance updates and ledger insertion commit together in a transaction. Concurrent spending cannot overdraw the purse.
- A unique `(tripId, recordedBy, clientId)` index per ledger prevents duplicate writes on retries. Reusing an ID for different content returns an error. The frontend retains its ID when retrying an unchanged open form; it has no durable offline queue yet.
- These are records of payments already made. The app does not transfer money or record money received.

## Verification

```powershell
npm run check
npm test
npm run test:integration
npm run build
```

- 16 local tests cover schemas, authorization rules, private visibility, integer splits, and direct offsets.
- Live integration tests cover distinct identities, create/join, membership, private expenses, impersonation rejection, concurrent retries, changed-payload rejection, contributions, and concurrent overspending.
- Integration tests create a fresh `ttest_<uuid>` database and remove only that generated database in cleanup. The configured application database is not cleared.
- Browser-verified trip creation, a private ₹50 payment, a ₹500 contribution, a ₹125 group expense, and the ₹375 purse balance persisting after reload. These records are clearly labeled in **Demo trip — browser check** under **Demo traveler**.
- Read-only legacy audit before this stage found zero old-format trips and zero old-format expenses. No data migration or deletion was needed.

## Next stage

Add authenticated socket subscriptions with per-recipient visibility, then IndexedDB offline storage and durable sync. Account recovery, session expiry/revocation, invitation abuse controls, deployment configuration, and PWA installation follow before public release.

[GitHub repository](https://github.com/shahrukh-210906/trip-expense-tracker)
