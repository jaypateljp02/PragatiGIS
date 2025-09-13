import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from "../shared/schema-sqlite";
import path from 'path';

// SQLite database file location
const dbPath = path.join(process.cwd(), 'local-database.db');

// Create SQLite database connection
export const sqlite = new Database(dbPath);

// Enable WAL mode for better concurrent access
sqlite.pragma('journal_mode = WAL');

// Create Drizzle instance with SQLite
export const db = drizzle(sqlite, { schema });

// Health check function
export async function healthCheck(): Promise<boolean> {
  try {
    const result = sqlite.prepare('SELECT 1').get();
    console.log('Local SQLite database health check passed');
    return true;
  } catch (error) {
    console.error('Local SQLite database health check failed:', error);
    return false;
  }
}

// Graceful shutdown handler
export async function gracefulShutdown(): Promise<void> {
  console.log('Shutting down SQLite database connection...');
  sqlite.close();
  console.log('SQLite database shutdown complete');
}

// Setup process signal handlers
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

console.log(`Local SQLite database connected at: ${dbPath}`);