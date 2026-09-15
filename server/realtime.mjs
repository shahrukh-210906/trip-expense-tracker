import { Server } from 'socket.io';
import mongoose from 'mongoose';
import { tokenHash } from './auth.mjs';
import { isMember, canReadPersonalExpense, canReadPurseEntry } from './access.mjs';

const room = (tripId, userId) => `trip:${tripId}:user:${userId}`;

export function attachRealtime(httpServer, models) {
  const io = new Server(httpServer, { maxHttpBufferSize: 8192 });
  io.use(async (socket, next) => {
    const { token, tripId } = socket.handshake.auth || {};
    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token) || !mongoose.isObjectIdOrHexString(tripId)) {
      return next(new Error('Unauthorized trip subscription.'));
    }
    try {
      const [user, trip] = await Promise.all([
        models.User.findOne({ tokenHash: tokenHash(token) }), models.Trip.findById(tripId),
      ]);
      if (!user || !trip || !isMember(trip, user._id)) return next(new Error('Unauthorized trip subscription.'));
      socket.data.userId = String(user._id);
      socket.data.tripId = String(trip._id);
      next();
    } catch { next(new Error('Trip updates are unavailable.')); }
  });
  io.on('connection', socket => {
    // A connection has one authenticated subscription. No client-controlled room joins.
    socket.join(room(socket.data.tripId, socket.data.userId));
  });
  const notify = (trip, recipients) => {
    if (recipients.length) io.to(recipients.map(id => room(trip._id, id))).emit('trip:changed', { tripId: String(trip._id) });
  };
  return {
    io,
    entryChanged(trip, entry, ledger) {
      const canRead = ledger === 'personal' ? canReadPersonalExpense : canReadPurseEntry;
      notify(trip, trip.participants.filter(id => canRead(trip, id, entry)));
    },
    membersChanged(trip) { notify(trip, trip.participants); },
  };
}
