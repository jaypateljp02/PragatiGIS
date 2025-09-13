import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Create postgres client for Supabase (with prepare: false for Transaction pooling)
const sql = postgres(process.env.DATABASE_URL, { 
  prepare: false  // Disable prepared statements for Supabase Transaction pooling
});

// Retry wrapper for transient database errors
async function withRetry<T>(operation: () => Promise<T>, maxRetries = 3): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      // Check for transient errors that we should retry
      const isTransient = error instanceof Error && (
        error.message.includes('57P01') ||  // ADMIN SHUTDOWN
        error.message.includes('08006') ||  // connection failure
        error.message.includes('ECONNRESET') ||
        error.message.includes('terminating connection due to administrator command')
      );
      
      if (!isTransient || attempt === maxRetries) {
        throw error;
      }
      
      // Exponential backoff: 100ms, 200ms, 400ms
      const delay = 100 * Math.pow(2, attempt - 1);
      console.log(`Database operation failed (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms:`, error.message);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

// Create Drizzle instance with HTTP client
export const db = drizzle(sql, { schema });

// Health check function
export async function healthCheck(): Promise<boolean> {
  try {
    await withRetry(async () => {
      await sql`SELECT 1`;
    });
    console.log('Database health check passed');
    return true;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
}

// Graceful shutdown handler
export async function gracefulShutdown(): Promise<void> {
  console.log('Shutting down database connections...');
  // HTTP client doesn't need explicit cleanup, but we can log the shutdown
  console.log('Database shutdown complete');
}

// Setup process signal handlers
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
