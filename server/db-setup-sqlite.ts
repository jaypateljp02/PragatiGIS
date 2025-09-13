// Simple SQLite setup - manually replace server/db.ts with this content when you want to use local database
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { 
  sqliteTable, 
  text, 
  integer, 
  real, 
  blob 
} from "drizzle-orm/sqlite-core";
import { sql } from 'drizzle-orm';
import bcrypt from "bcrypt";
import path from 'path';

// SQLite database file
const dbPath = path.join(process.cwd(), 'local-database.db');
console.log(`🗄️ Using local SQLite database at: ${dbPath}`);

// Create SQLite connection
export const sqlite = new Database(dbPath);
sqlite.pragma('journal_mode = WAL');

// Define SQLite schema (simplified version matching your PostgreSQL schema)
export const states = sqliteTable("states", {
  id: integer("id").primaryKey(),
  name: text("name").notNull().unique(),
  code: text("code").notNull().unique(),
  language: text("language"),
  createdAt: integer("created_at", { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

export const districts = sqliteTable("districts", {
  id: integer("id").primaryKey(),
  name: text("name").notNull(),
  stateId: integer("state_id").references(() => states.id).notNull(),
  createdAt: integer("created_at", { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

export const users = sqliteTable("users", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  fullName: text("full_name").notNull(),
  role: text("role").notNull(),
  stateId: integer("state_id").references(() => states.id),
  districtId: integer("district_id").references(() => districts.id),
  isActive: integer("is_active", { mode: 'boolean' }).default(true),
  createdAt: integer("created_at", { mode: 'timestamp' }).default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

export const userSessions = sqliteTable("user_sessions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").references(() => users.id).notNull(),
  token: text("token").notNull().unique(),
  expiresAt: integer("expires_at", { mode: 'timestamp' }).notNull(),
  createdAt: integer("created_at", { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

export const claims = sqliteTable("claims", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  claimId: text("claim_id").notNull().unique(),
  claimantName: text("claimant_name").notNull(),
  location: text("location").notNull(),
  district: text("district").notNull(),
  state: text("state").notNull(),
  area: real("area").notNull(),
  landType: text("land_type").notNull(),
  status: text("status").notNull(),
  dateSubmitted: integer("date_submitted", { mode: 'timestamp' }).notNull(),
  dateProcessed: integer("date_processed", { mode: 'timestamp' }),
  assignedOfficer: text("assigned_officer").references(() => users.id),
  familyMembers: integer("family_members"),
  coordinates: text("coordinates", { mode: 'json' }),
  notes: text("notes"),
  createdAt: integer("created_at", { mode: 'timestamp' }).default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

export const documents = sqliteTable("documents", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  claimId: text("claim_id").references(() => claims.id),
  filename: text("filename").notNull(),
  originalFilename: text("original_filename").notNull(),
  fileType: text("file_type").notNull(),
  fileSize: integer("file_size").notNull(),
  uploadPath: text("upload_path"),
  fileContent: blob("file_content"),
  ocrStatus: text("ocr_status").notNull(),
  ocrText: text("ocr_text"),
  extractedData: text("extracted_data", { mode: 'json' }),
  confidence: real("confidence"),
  reviewStatus: text("review_status").default('pending'),
  reviewedBy: text("reviewed_by").references(() => users.id),
  uploadedBy: text("uploaded_by").references(() => users.id).notNull(),
  createdAt: integer("created_at", { mode: 'timestamp' }).default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

export const auditLog = sqliteTable("audit_log", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").references(() => users.id).notNull(),
  action: text("action").notNull(),
  resourceType: text("resource_type").notNull(),
  resourceId: text("resource_id").notNull(),
  changes: text("changes", { mode: 'json' }),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: integer("created_at", { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

// Create Drizzle instance
export const db = drizzle(sqlite, { 
  schema: { 
    users, 
    userSessions, 
    claims, 
    documents, 
    auditLog, 
    states, 
    districts 
  } 
});

// Initialize database
async function initializeSQLite() {
  console.log('🏗️ Initializing SQLite database...');
  
  // Create tables
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS states (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      code TEXT NOT NULL UNIQUE,
      language TEXT,
      created_at INTEGER DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS districts (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      state_id INTEGER NOT NULL REFERENCES states(id),
      created_at INTEGER DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL,
      state_id INTEGER REFERENCES states(id),
      district_id INTEGER REFERENCES districts(id),
      is_active INTEGER DEFAULT 1,
      created_at INTEGER DEFAULT (unixepoch()),
      updated_at INTEGER DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS user_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      token TEXT NOT NULL UNIQUE,
      expires_at INTEGER NOT NULL,
      created_at INTEGER DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS claims (
      id TEXT PRIMARY KEY,
      claim_id TEXT NOT NULL UNIQUE,
      claimant_name TEXT NOT NULL,
      location TEXT NOT NULL,
      district TEXT NOT NULL,
      state TEXT NOT NULL,
      area REAL NOT NULL,
      land_type TEXT NOT NULL,
      status TEXT NOT NULL,
      date_submitted INTEGER NOT NULL,
      date_processed INTEGER,
      assigned_officer TEXT REFERENCES users(id),
      family_members INTEGER,
      coordinates TEXT,
      notes TEXT,
      created_at INTEGER DEFAULT (unixepoch()),
      updated_at INTEGER DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      claim_id TEXT REFERENCES claims(id),
      filename TEXT NOT NULL,
      original_filename TEXT NOT NULL,
      file_type TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      upload_path TEXT,
      file_content BLOB,
      ocr_status TEXT NOT NULL,
      ocr_text TEXT,
      extracted_data TEXT,
      confidence REAL,
      review_status TEXT DEFAULT 'pending',
      reviewed_by TEXT REFERENCES users(id),
      uploaded_by TEXT NOT NULL REFERENCES users(id),
      created_at INTEGER DEFAULT (unixepoch()),
      updated_at INTEGER DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      action TEXT NOT NULL,
      resource_type TEXT NOT NULL,
      resource_id TEXT NOT NULL,
      changes TEXT,
      ip_address TEXT,
      user_agent TEXT,
      created_at INTEGER DEFAULT (unixepoch())
    );
  `);

  // Check if data already exists
  const existingStates = sqlite.prepare('SELECT * FROM states LIMIT 1').all();
  if (existingStates.length > 0) {
    console.log('✅ Database already has data, skipping seed');
    return;
  }

  console.log('🌱 Seeding database with initial data...');
  
  // Seed data
  const SALT_ROUNDS = 12;

  // States
  const statesData = [
    { id: 1, name: "Madhya Pradesh", code: "MP", language: "Hindi" },
    { id: 2, name: "Odisha", code: "OR", language: "Odia" },
    { id: 3, name: "Telangana", code: "TG", language: "Telugu" },
    { id: 4, name: "Tripura", code: "TR", language: "Bengali" },
    { id: 5, name: "Maharashtra", code: "MH", language: "Marathi" },
    { id: 6, name: "Gujarat", code: "GJ", language: "Gujarati" },
  ];

  const insertState = sqlite.prepare('INSERT INTO states (id, name, code, language) VALUES (?, ?, ?, ?)');
  statesData.forEach(state => {
    insertState.run(state.id, state.name, state.code, state.language);
  });

  // Districts
  const districtsData = [
    { id: 1, name: "Mandla", stateId: 1 },
    { id: 2, name: "Balaghat", stateId: 1 },
    { id: 3, name: "Mayurbhanj", stateId: 2 },
    { id: 4, name: "Keonjhar", stateId: 2 },
    { id: 5, name: "Adilabad", stateId: 3 },
    { id: 6, name: "Warangal", stateId: 3 },
  ];

  const insertDistrict = sqlite.prepare('INSERT INTO districts (id, name, state_id) VALUES (?, ?, ?)');
  districtsData.forEach(district => {
    insertDistrict.run(district.id, district.name, district.stateId);
  });

  // Demo users
  const demoUsersData = [
    {
      id: "admin-1", 
      username: "ministry.admin", 
      email: "admin@tribal.gov.in", 
      password: await bcrypt.hash("admin123", SALT_ROUNDS), 
      fullName: "Ministry Administrator", 
      role: "ministry",
      stateId: null, 
      districtId: null, 
      isActive: 1
    },
    {
      id: "state-1", 
      username: "mp.admin", 
      email: "mp@tribal.gov.in",
      password: await bcrypt.hash("state123", SALT_ROUNDS), 
      fullName: "MP State Administrator", 
      role: "state",
      stateId: 1, 
      districtId: null, 
      isActive: 1
    },
    {
      id: "district-1", 
      username: "district.officer", 
      email: "district@tribal.gov.in",
      password: await bcrypt.hash("district123", SALT_ROUNDS), 
      fullName: "District Officer", 
      role: "district",
      stateId: 1, 
      districtId: 1, 
      isActive: 1
    },
    {
      id: "village-1", 
      username: "village.officer", 
      email: "village@tribal.gov.in",
      password: await bcrypt.hash("village123", SALT_ROUNDS), 
      fullName: "Village Officer", 
      role: "village",
      stateId: 1, 
      districtId: 1, 
      isActive: 1
    }
  ];

  const insertUser = sqlite.prepare(`
    INSERT INTO users (id, username, email, password, full_name, role, state_id, district_id, is_active) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  demoUsersData.forEach(user => {
    insertUser.run(
      user.id, user.username, user.email, user.password, 
      user.fullName, user.role, user.stateId, user.districtId, user.isActive
    );
  });

  console.log('✅ SQLite database initialized successfully!');
  console.log('👥 Demo users created:');
  console.log('   - ministry.admin / admin123 (Ministry Administrator)');
  console.log('   - mp.admin / state123 (MP State Administrator)');
  console.log('   - district.officer / district123 (District Officer)');
  console.log('   - village.officer / village123 (Village Officer)');
}

// Initialize on import
initializeSQLite().catch(console.error);

// Health check
export async function healthCheck(): Promise<boolean> {
  try {
    sqlite.prepare('SELECT 1').get();
    console.log('✅ Local SQLite database health check passed');
    return true;
  } catch (error) {
    console.error('❌ Local SQLite database health check failed:', error);
    return false;
  }
}

// Graceful shutdown
export async function gracefulShutdown(): Promise<void> {
  console.log('🔌 Shutting down SQLite database connection...');
  sqlite.close();
  console.log('✅ SQLite database shutdown complete');
}

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);