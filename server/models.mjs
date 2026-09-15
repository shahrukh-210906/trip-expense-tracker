import mongoose from 'mongoose';

const tripSchema = new mongoose.Schema({
  name: { type: String, required: true },
  joinCode: { type: String, required: true, unique: true },
  groupLead: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  kittyBalance: { type: Number, default: 0 }
}, { timestamps: true });

const expenseSchema = new mongoose.Schema({
  tripId: { type: mongoose.Schema.Types.ObjectId, ref: 'Trip', required: true },
  title: { type: String, required: true },
  amount: { type: Number, required: true },
  expenseType: { type: String, enum: ['kitty', 'personal'], required: true },
  paidBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  splitAmong: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  clientCreatedAt: { type: Date, required: true } // Captured from the offline device
}, { timestamps: true });

export const Trip = mongoose.model('Trip', tripSchema);
export const Expense = mongoose.model('Expense', expenseSchema);