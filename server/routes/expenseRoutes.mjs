import express from 'express';
import { Expense, Trip } from '../models.mjs';

const router = express.Router();

const processExpense = async (expenseData) => {
  const { tripId, title, amount, expenseType, paidBy, splitAmong, clientCreatedAt } = expenseData;
  const trip = await Trip.findById(tripId);
  if (!trip) throw new Error('Trip not found');

  if (expenseType === 'kitty') {
    if (trip.groupLead.toString() !== paidBy.toString()) throw new Error('Only Group Lead uses Kitty');
    trip.kittyBalance -= amount;
    await trip.save();
  }

  const finalSplit = expenseType === 'personal' ? [paidBy] : splitAmong;

  const newExpense = new Expense({
    tripId, title, amount, expenseType, paidBy, splitAmong: finalSplit, clientCreatedAt
  });

  return await newExpense.save();
};

router.post('/sync', async (req, res) => {
  try {
    const { offlineExpenses } = req.body;
    if (!Array.isArray(offlineExpenses) || offlineExpenses.length === 0) {
      return res.status(400).json({ error: 'No expenses to sync' });
    }

    const savedExpenses = [];
    const errors = [];
    const io = req.app.get('io'); // Retrieve Socket.io instance

    for (const expenseData of offlineExpenses) {
      try {
        const saved = await processExpense(expenseData);
        savedExpenses.push(saved);
        
        // Broadcast to the Live Feed[cite: 2]
        io.to(expenseData.tripId.toString()).emit('newExpense', saved);
      } catch (err) {
        errors.push({ title: expenseData.title, error: err.message });
      }
    }

    res.status(200).json({ success: true, syncedCount: savedExpenses.length, savedExpenses, errors });
  } catch (error) {
    res.status(500).json({ error: 'Batch sync failed' });
  }
});

export default router;