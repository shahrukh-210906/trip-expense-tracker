# Trip Expense Tracker

## First-visit tutorial — September 21, 2026

New browser visitors see a skippable six-step tour with demo screenshots and numbered highlights for trips, expenses, splits, Kitty, and settlement. Completion or dismissal is remembered on that browser; **How to use TripRoam** reopens the tour. The installation step includes an app screenshot and clearly labeled browser-menu illustrations for Android, iPhone/iPad, and desktop. These assets are cached with the offline app shell.

Screenshot fixtures are development-only: run the Vite client and open `/tutorial-capture.html?screen=trips` (also `overview`, `expense`, `kitty`, `settlement`, `install`). They use fictional data and are not part of the production entry. Regenerate the browser-menu illustrations with `node scripts/tutorial-art.mjs`.

Validated: production build, syntax checks, all tour steps/images, device tabs, completion persistence after reload, replay, Escape/focus restoration, and no horizontal overflow at 320px.

## Current release: mobile redesign, Kitty settlement, and End trip

This section supersedes the historical milestone notes below.

- Mobile navigation: Overview, Live Feed, Settlement; fixed Add expense action; minimal Google sign-in; dashboard with direct PIN entry and active/ended trip cards.
- Revised navy/blue interface with readable cards, phone-safe spacing, bottom-sheet entry, optional numeric keypad, and explicit sync indicators. Browser offline events and service-worker network failures show an Offline Mode badge.
- Kitty expenses support a selected list of participants. Existing entries without a participant list are treated as shared across the trip; new entries persist the selection. Members can view Kitty history and contribute; only leads record Kitty spending.
- Kitty balances can go negative: the first group lead is the custodian who advances the shortfall. Each member's Kitty credit equals contributions minus their allocated spending. A positive credit is refunded by the lead; a negative credit is paid to the lead. Because contributions and beneficiaries can differ, a trip may have both refunds and amounts due. Personal balances remain a separate ledger; Overview net balance includes both.
- Leads can end a trip after confirmation. It locks new expenses, contributions, and joins while keeping history and final settlement available. Trip state and expense writes serialize on the trip document, preventing expenses after closure. Retries of already saved entries remain accepted. Everyone should sync first; the lead cannot detect another device's unsynced queue.
- Checks: 32 local tests and isolated MongoDB integration tests passed, including selected Kitty beneficiaries, signed balances, refunds, rejected member spending, end-trip permissions, and locked writes. Browser review used isolated sample data, not real-account writes; checked phone and landscape layouts, expense entry, member controls, and end-trip state.


## Google login — September 16, 2026

Open **http://localhost:5000** and choose **Continue with Google**. Google is the only new-account/login method. Existing browser travelers can choose **Link Google account** on the trips screen to preserve their trips and expenses. Link before signing out of a legacy traveler. Use the same Google account to return on another device; signing in rotates the app session, so the previous device must sign in again.

Firebase Admin verifies the Google ID token (including revocation) before issuing the existing 30-day app session. Admin credentials remain in root `.env`; `/api/auth/config` exposes only public web settings. Google must be enabled in Firebase Authentication and the app hostname must be an authorized domain. Both `localhost` and `127.0.0.1` are authorized. Existing travelers should link at their original browser address because browser storage is origin-specific. Sign out revokes the app session. Existing offline queues remain scoped to their traveler.

Verified: Firebase Admin connectivity, Google provider enabled, 28 local tests, database integration including identity reuse/linking, and production build. Interactive Google consent must be completed by the account owner. The older progress notes below describe earlier milestones.

A React + Express + MongoDB app for personal payments, direct debts between travelers, and a separate group purse. The original design prototype remains in `prototype/`.

## Task status — September 16, 2026

| Stage | Status |
| --- | --- |
| UI prototype | Completed in the earlier task |
| MongoDB connection | Verified with the configured Atlas database |
| Models and access rules | Repaired and tested; personal expenses and purse entries use separate collections |
| Traveler identity and trip codes | Working browser sessions, create/join, and membership checks |
| Expense API and retry protection | Working for personal payments, contributions, and lead-only spending |
| Settlement calculations | Direct pairwise offsets with integer paise and deterministic remainder allocation |
| React integration | Working trip selection, expenses, balances, group purse, and unified Add expense |
| Real-time updates | Working authenticated subscriptions, permission-filtered notifications, reconnect refresh, and connection status |
| Offline queue and cached app loading | Working durable browser queue, automatic retries, and offline reload of previously opened trips |
| Installable PWA | Manifest, icons, and installation flow pending |
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
- A unique `(tripId, recordedBy, clientId)` index per ledger prevents duplicate writes on retries. Reusing an ID for different content returns an error. The frontend persists each payment and its original ID in IndexedDB before reporting a save; retries use that same ID after reload or a lost response.
- These are records of payments already made. The app does not transfer money or record money received.

## Verification

```powershell
npm run check
npm test
npm run test:integration
npm run build
```

- 27 local tests cover schemas, authorization rules, private visibility, integer splits, direct offsets, refresh races, and offline storage/sync recovery.
- Live integration tests cover distinct identities, create/join, membership, private expenses, impersonation rejection, concurrent retries, changed-payload rejection, contributions, and concurrent overspending.
- Integration tests create a fresh `ttest_<uuid>` database and remove only that generated database in cleanup. The configured application database is not cleared.
- Browser-verified trip creation, a private ₹50 payment, a ₹500 contribution, a ₹125 group expense, and the ₹375 purse balance persisting after reload. These records are clearly labeled in **Demo trip — browser check** under **Demo traveler**.
- Read-only legacy audit before this stage found zero old-format trips and zero old-format expenses. No data migration or deletion was needed.

## Next stage

Next are account recovery and session expiry/revocation, followed by invitation abuse controls, PWA installation, and deployment configuration before public release.

## Live updates — completed September 16

- Each Socket.IO connection authenticates the traveler token and checks membership for one trip. Switching trips disconnects the previous subscription. Clients cannot choose arbitrary rooms.
- Successful writes notify only people authorized to see the entry: the owner for private expenses, trip members for shared expenses, leads plus the contributor for contributions, and leads for purse spending. Failed writes and ordinary duplicate retries do not broadcast.
- Notifications contain only a trip ID. The client retrieves a fresh snapshot through the protected API; no expense details or purse amounts are broadcast.
- Member joins update existing viewers. Reconnecting reloads changes missed during disconnection, and the header shows connection status. Manual Refresh remains available.
- Refreshes are serialized, coalesced, and discarded if another change arrives during the request or the user leaves the trip. Updating data does not reset open expense forms.
- Live MongoDB integration tests cover unauthorized subscriptions, cross-trip isolation, private and purse notification visibility, duplicates, failed writes, member joins, and reconnect authorization. A browser check saved **Live sync check (demo)** for ₹0.01 in one tab and observed it in another without refreshing.
- Live updates support a single API process. Multiple server instances require a shared Socket.IO adapter; crash-proof server event delivery remains future work. It does not make the localhost app publicly accessible.

## Offline saving and automatic sync — completed September 16

- Payments are written to an IndexedDB outbox before the form closes. If local storage fails, the form stays open and does not claim a successful save.
- Pending entries remain separate from confirmed expense history and balances. This also applies to contributions and purse spending: the server validates funds and permissions at sync time.
- The queue distinguishes waiting, accepted-but-refreshing, and rejected entries. Rejected entries retain their original data and a Retry action; transient connection/database failures retry automatically.
- Sync runs when the app opens, receives a connection event, returns online, or checks again every 30 seconds while open. Batches contain at most 100 entries. Browser locks coordinate tabs where supported; server idempotency protects retries on all browsers.
- Confirmed receipts remain in the outbox until a fresh trip snapshot includes the corresponding entry. Snapshot caching and receipt removal happen in one local transaction, so a reload cannot lose the confirmed record from view.
- Cached trip lists and authorized trip snapshots are scoped to the traveler. An explicit access-denied response clears the affected cached trip. Offline views reflect the permissions and data from the last successful connection.
- `npm run build` generates a versioned service worker that caches only the application HTML, JavaScript, and CSS. API responses and socket traffic are never service-worker cached. A previously loaded app/trip can reopen with the server disconnected.
- Tests cover persistent reload recovery, user isolation, lost replies after server commit, mixed accepted/rejected batches, retryable failures, concurrent tabs, and batching. Browser verification saved **Offline recovery check (demo)** for ₹0.01 with the server stopped, reloaded successfully, then synced it once on reconnection.
- Open each trip online at least once before using it offline. Keep or reopen the app to sync; closed-app background sync is not implemented. Clearing browser site data removes unsynced payments and the local session. Installation prompts/icons and public HTTPS deployment are still pending.

## UI usability refinement

- Three focused sections replace the overlapping overview and personal-pocket pages: **Expenses**, **Balances**, and **Group purse**.
- Expenses has one searchable ledger with **My payments** and **Shared expenses** views. Expand a payment to see each person's share. Private entries carry an **Only you** label.
- Balances leads with who owes you and whom you owe. Whole-trip balances are available on demand.
- The purse has a distinct funds summary, money-in/money-out history filters, and one contextual **Record purse spending** action.
- Add expense presents explicit payment types: personal expense, contribution, and (for leads) purse spending. It previews the split or purse effect before saving. The heading and save action remain visible while the form body scrolls.
- Trip selection separates existing trips from creating or joining a trip. Invitation codes and the member list are available from the traveler control.
- Browser verification covered the redesigned workspace, expandable payment details, saving and finding a private ₹0.01 **UI review check (demo)** expense, and the purse layout at a 390px phone breakpoint. The production frontend build passes.

[GitHub repository](https://github.com/shahrukh-210906/trip-expense-tracker)

## PWA and session fixes — September 16, 2026

Added an installable manifest, 192/512px icons, maskable and Apple touch icons, theme metadata, and installation controls with browser-specific fallback guidance. The service worker caches the manifest and icons with the app shell. Installation requires browser support and HTTPS or a loopback address; public mobile access still needs deployment. Native installation was not performed in the embedded browser.

Preloaded Firebase sign-in setup and improved popup failure guidance. Google account consent remains user-driven; a cancelled popup does not establish successful login. Expired/revoked sessions now fail realtime authentication as well as HTTP authentication; logout and Google session rotation disconnect existing live subscriptions. Late requests from an older session cannot clear a newer login.

Validation: 29 local tests, isolated MongoDB integration suite, production build, manifest/icon dimensions, and browser checks of the signed-out screen and installation instructions passed.

## Group purse visibility update
All trip members can now view the purse balance, complete money-in/money-out history, and live updates. The purse page is read-only for non-leads; only leads can record purse spending or opening balances. Members retain the existing ability to record their own contributions through Add expense. Outsiders have no access. Verified with local tests, database integration checks (including rejected member spending), and production build.
