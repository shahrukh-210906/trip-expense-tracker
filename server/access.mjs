// Reusable service-layer rules. Step 3/4 must call these with authenticated identity.
const same = (a, b) => a != null && b != null && String(a) === String(b);
export const isMember = (trip, userId) => trip.participants.some(id => same(id, userId));
export const isLead = (trip, userId) => isMember(trip, userId) && trip.groupLeads.some(id => same(id, userId));
export const isSelfOnly = expense => expense.splitAmong.length === 1 && same(expense.splitAmong[0], expense.recordedBy);
export function canReadPersonalExpense(trip, userId, expense) {
  return same(expense.tripId, trip._id) && isMember(trip, userId) &&
    (!isSelfOnly(expense) || same(expense.recordedBy, userId));
}
export function canReadPurseEntry(trip, userId, entry) {
  return same(entry.tripId, trip._id) && isMember(trip, userId);
}
export function assertCanRecord(trip, userId, entry, ledger) {
  if (!same(entry.tripId, trip._id) || !isMember(trip, userId) || !same(entry.recordedBy, userId)) {
    throw new Error('Only a trip member may record their own payment.');
  }
  if (ledger === 'personal') {
    if (!entry.splitAmong?.length || !entry.splitAmong.every(id => isMember(trip, id))) {
      throw new Error('Every beneficiary must belong to this trip.');
    }
  } else if (ledger === 'purse') {
    if (!['opening', 'contribution', 'expense'].includes(entry.kind)) throw new Error('Invalid purse entry.');
    if (entry.kind !== 'contribution' && !isLead(trip, userId)) throw new Error('Only group leads may manage the purse.');
    if (entry.kind === 'expense' && (!entry.splitAmong?.length || !entry.splitAmong.every(id=>isMember(trip,id))))
      throw new Error('Choose trip members who share this Kitty expense.');
  } else throw new Error('Unknown ledger.');
}
