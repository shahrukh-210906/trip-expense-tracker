# Trip Expense Tracker

MERN Progressive Web App based on **Project Specification: Trip Expense Tracker App V2**.

## Step 1: interactive design prototype

Run `npm run dev` and open http://127.0.0.1:5173. Run `npm run check` for JavaScript syntax validation. Node.js is the only dependency at this stage.

The prototype covers overview, shared Kitty deposits and expenses, private Personal Pocket, a refund illustration, create/join forms, and simulated offline pending states. Amounts use integer paise. It contains sample data and resets on refresh. No payments, authentication, database, real sync, or production authorization exist yet. The temporary working title is **Roam**.

The specification requests Figma wireframes. This repository provides a browser-based substitute; no Figma artifact has been created.

## Delivery stages

| Step | Deliverable | Status |
| --- | --- | --- |
| 1 | Mobile-first UI flows and offline state wireframes | Browser prototype implemented |
| 2 | MongoDB Atlas and Mongoose schemas | Next |
| 3 | Express API, JWT identity, unique join codes | Planned |
| 4 | Authorized Kitty/personal ledgers and idempotent batch sync | Planned |
| 5 | Net balances, settlements, pairwise ledger | Planned |
| 6 | Authenticated Socket.io trip events | Planned |
| 7 | React responsive frontend wired to API | Planned |
| 8 | IndexedDB, offline queue, service worker, installable PWA | Planned |
| 9 | Render backend and Vercel frontend deployment | Planned |
| 10 | Share link and installation instructions | Planned |

Each stage should have a separate commit and GitHub push, followed by a completion report. GitHub publishing requires a repository remote and authenticated Git access.

## Next-stage setup

Provide the GitHub repository URL. For live database verification in Step 2, create a MongoDB Atlas cluster, database user, and network access rule for your development machine. Store the connection URI in a local ignored `.env` file as `MONGODB_URI`; never put credentials in committed files or chat. Mongoose schema implementation can proceed before the cluster is ready.

## Decisions carried into implementation

- Joining by PIN enrolls an authenticated identity; a PIN must not grant group-lead authority. Rate-limit joins and enforce role checks on the server.
- Personal entries are readable by their owner only and excluded from shared events and settlements.
- Deposits require a dedicated ledger model (missing from the abbreviated PDF schema). Treat the Kitty as a virtual clearing account when calculating refunds.
- Use integer minor currency units and deterministic remainder allocation. Never use floating-point arithmetic for balances.
- Batch sync needs client-generated IDs and a uniqueness constraint to prevent duplicate charges after retries. Preserve client event time separately from server receipt time.
- A six-character code requires collision handling. JWT sessions require expiry and secure storage choices before deployment.
- The specification does not define direct person-to-person funded shared expenses despite requesting a pairwise ledger. Resolve the schema in Step 4 and document how the ledger relates to Kitty contributions.
- Greedy settlement minimizes transfers heuristically but does not always prove the global minimum. Step 5 must document the algorithm and its guarantees.
- Offline entries remain pending until acknowledged by the server. Background sync support varies; app-open reconnect sync is also necessary.
