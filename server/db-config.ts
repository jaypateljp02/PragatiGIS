// Database configuration - using local SQLite permanently
console.log('🗄️  Using local SQLite database');
const localDb = require('./db-local');
module.exports = localDb;

export const isLocalDb = true;