import express from 'express';
import mongoose from 'mongoose';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';

import tripRoutes from './routes/tripRoutes.mjs';
import expenseRoutes from './routes/expenseRoutes.mjs';

dotenv.config();

const app = express();
const httpServer = createServer(app);

// Setup Real-Time Sockets[cite: 2]
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

// Make io accessible inside route handlers
app.set('io', io);

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/trips', tripRoutes);
app.use('/api/expenses', expenseRoutes);

// Socket.io Connection Logic
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Users join a "room" specific to their trip to get live updates
  socket.on('joinTripRoom', (tripId) => {
    socket.join(tripId);
    console.log(`Socket ${socket.id} joined trip room ${tripId}`);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Database and Server Init
const PORT = process.env.PORT || 5000;
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    httpServer.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch(err => console.error('MongoDB connection error:', err));