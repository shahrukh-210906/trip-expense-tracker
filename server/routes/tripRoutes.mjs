import express from 'express';
import { Trip, Expense } from '../models.mjs';
import { calculateSettlement } from '../utils/settlement.mjs';

const router = express.Router();

const generateJoinCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();

router.post('/create', async (req, res) => {
  try {
    const { name, userId } = req.body;
    let joinCode = generateJoinCode();
    
    while (await Trip.findOne({ joinCode })) {
      joinCode = generateJoinCode();
    }

    const newTrip = new Trip({ name, joinCode, groupLead: userId, participants: [userId], kittyBalance: 0 });
    await newTrip.save();
    res.status(201).json({ success: true, trip: newTrip });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create trip' });
  }
});

router.post('/join', async (req, res) => {
  try {
    const { joinCode, userId } = req.body;
    const trip = await Trip.findOne({ joinCode: joinCode.toUpperCase() });
    
    if (!trip) return res.status(404).json({ error: 'Invalid PIN' });
    if (!trip.participants.includes(userId)) {
      trip.participants.push(userId);
      await trip.save();
    }
    res.status(200).json({ success: true, trip });
  } catch (error) {
    res.status(500).json({ error: 'Failed to join trip' });
  }
});

// Settlement Endpoint
router.get('/:tripId/settlement', async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.tripId);
    if (!trip) return res.status(404).json({ error: 'Trip not found' });

    const expenses = await Expense.find({ tripId: trip._id });
    const transactions = calculateSettlement(expenses, trip.participants);
    
    res.status(200).json({ success: true, transactions });
  } catch (error) {
    res.status(500).json({ error: 'Failed to calculate settlement' });
  }
});

export default router;