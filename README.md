# Trip Expense Tracker

## Current requirements (user revision)

Everyone records their own out-of-pocket payments. A payment can be for the payer, one friend, or several selected travelers. A separate group purse is available only to designated group leads. There is no money-received logging workflow. These instructions supersede the corresponding requirements in the original PDF and earlier prototypes.

- One Add expense action. Payer is the current traveler.
- Select beneficiaries independently of the payer; paying entirely for a friend is supported.
- Split equally across selected people using integer paise; distribute any remaining paise in stable selection order.
- Self-only expenses create no debts and are hidden from other travelers' activity.
- Show direct balances between each pair after offsetting payments in both directions.
- Each traveler sees What I paid and Who owes whom.

## Run

`npm run dev`, then open http://127.0.0.1:5173. `npm run check` validates JavaScript syntax.

This is an interactive design prototype. The Preview as selector simulates separate accounts, not real authentication. Data resets on refresh. Offline mode simulates pending labels; no durable storage, server sync, or real payments are connected.

## Roadmap

1. UI prototype: implemented, revised for self-recorded payments and friends' debts.
2. MongoDB/Mongoose schemas: next, with personal payer/beneficiary records and a separate group purse plus designated leads.
3. Express/JWT identity and trip join codes.
4. Expense APIs, ownership authorization, and idempotent batch sync.
5. Verified settlement logic and detailed pairwise history.
6. Socket.io trip updates, excluding self-only expenses.
7. React frontend connected to the API.
8. IndexedDB offline queue and installable PWA.
9. Render/Vercel deployment.
10. Sharing and installation guide.

Each completed stage or requested revision is committed and pushed to https://github.com/shahrukh-210906/trip-expense-tracker.

## Verification of this revision

JavaScript syntax checks pass. Browser check: recording ₹600 entirely for Aarav increased his pre-existing ₹600 net debt to ₹1,200; switching to Aarav showed the matching amount owed. The form displays each beneficiary's share before saving. A self-only sample appears only in the payer's own expenses. Real authorization and durable multi-user behavior remain future work.

## Next-stage setup

MongoDB schema work can begin without a cloud account. Live database verification requires an Atlas cluster and a local ignored `.env` with `MONGODB_URI`. Do not commit credentials.

## Group purse clarification

Both purses are required. All travelers log their own personal-pocket payments, including payments for friends. Only group leads can view the group purse balance/history or record its expenses. The prototype uses a sample ₹20,000 opening balance; the funding setup remains to be finalized. Group expenses do not become debts owed personally to the lead. Browser verification: a ₹500 group payment reduced the purse to ₹19,500, while switching to Aarav hid the purse and preserved his ₹600 personal debt. Account switching closes expense dialogs. These client-side role checks are a UI simulation, not security: the backend must enforce lead-only reads and writes and prevent unauthorized socket payloads.
