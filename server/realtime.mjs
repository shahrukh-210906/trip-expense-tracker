import { Server } from 'socket.io';
import mongoose from 'mongoose';
import { tokenHash, sessionValid, SESSION_LIFETIME_MS } from './auth.mjs';
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
      if (!sessionValid(user) || !trip || !isMember(trip, user._id)) return next(new Error('Unauthorized trip subscription.'));
      socket.data.userId = String(user._id);
      socket.data.tripId = String(trip._id);
      socket.data.expiresAt = user.tokenCreatedAt.getTime()+SESSION_LIFETIME_MS;
      next();
    } catch { next(new Error('Trip updates are unavailable.')); }
  });
  io.on('connection', socket => {
    // A connection has one authenticated subscription. No client-controlled room joins.
    socket.join(room(socket.data.tripId, socket.data.userId));
    const timer=setTimeout(()=>socket.disconnect(true),Math.min(2147483647,Math.max(0,socket.data.expiresAt-Date.now())));
    socket.on('disconnect',()=>clearTimeout(timer));
  });
  const notify = (trip, recipients) => {
    if (recipients.length) io.to(recipients.map(id => room(trip._id, id))).emit('trip:changed', { tripId: String(trip._id) });
  };
  return {
    io,
    disconnectUser(userId){for(const socket of io.sockets.sockets.values())if(socket.data.userId===String(userId))socket.disconnect(true);},
    entryChanged(trip, entry, ledger) {
      const canRead = ledger === 'personal' ? canReadPersonalExpense : canReadPurseEntry;
      notify(trip, trip.participants.filter(id => canRead(trip, id, entry)));
    },
    membersChanged(trip) { notify(trip, trip.participants); },
  };
}
