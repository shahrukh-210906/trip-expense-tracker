export const calculateSettlement = (expenses, participants) => {
  const balances = {};
  participants.forEach(userId => {
    balances[userId.toString()] = 0;
  });

  expenses.forEach(expense => {
    // Completely ignore personal pockets
    if (expense.expenseType === 'personal') return;

    const amount = expense.amount;
    const payerId = expense.paidBy.toString();
    const splitAmong = expense.splitAmong.map(id => id.toString());
    const splitAmount = amount / splitAmong.length;

    if (balances[payerId] !== undefined) balances[payerId] += amount;
    
    splitAmong.forEach(userId => {
      if (balances[userId] !== undefined) balances[userId] -= splitAmount;
    });
  });

  const debtors = [];
  const creditors = [];

  for (const [userId, balance] of Object.entries(balances)) {
    const roundedBalance = Math.round(balance * 100) / 100; 
    if (roundedBalance < 0) debtors.push({ userId, amount: Math.abs(roundedBalance) });
    else if (roundedBalance > 0) creditors.push({ userId, amount: roundedBalance });
  }

  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  const transactions = [];
  let i = 0, j = 0;

  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];
    const settledAmount = Math.min(debtor.amount, creditor.amount);

    transactions.push({
      from: debtor.userId,
      to: creditor.userId,
      amount: Math.round(settledAmount * 100) / 100
    });

    debtor.amount -= settledAmount;
    creditor.amount -= settledAmount;

    if (debtor.amount === 0) i++;
    if (creditor.amount === 0) j++;
  }

  return transactions;
};