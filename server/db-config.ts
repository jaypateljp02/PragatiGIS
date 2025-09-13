// Database configuration selector
// Set USE_LOCAL_DB=true in environment to use SQLite, otherwise uses Neon

const useLocalDb = process.env.USE_LOCAL_DB === 'true';

if (useLocalDb) {
  console.log('🗄️  Using local SQLite database');
  const localDb = require('./db-local');
  module.exports = localDb;
} else {
  console.log('☁️  Using remote Neon PostgreSQL database');
  const remoteDb = require('./db');
  module.exports = remoteDb;
}

export const isLocalDb = useLocalDb;