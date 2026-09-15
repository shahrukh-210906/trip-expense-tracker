import { connectDatabase, disconnectDatabase } from '../server/database.mjs';
import { createModels } from '../server/models.mjs';

try {
  const connection = await connectDatabase();
  await connection.db.command({ ping: 1 });
  const legacyTrips = await connection.db.collection('trips').countDocuments({ groupLead: { $exists: true }, groupLeads: { $exists: false } });
  const legacyExpenses = await connection.db.collection('expenses').countDocuments();
  console.log('Legacy data audit: ' + legacyTrips + ' old-format trips, ' + legacyExpenses + ' old-format expenses.');
  if (process.argv.includes('--indexes')) {
    for (const model of Object.values(createModels(connection))) await model.createIndexes();
    console.log('Database reachable; required indexes created.');
  } else console.log('Database connection verified.');
} catch (error) {
  // Driver messages may contain connection details. Do not print them.
  console.error(error.message === 'Set MONGODB_URI in your local .env file.' ? error.message :
    'Database check failed. Check Atlas network access, credentials, and database permissions.');
  process.exitCode = 1;
} finally { await disconnectDatabase(); }
