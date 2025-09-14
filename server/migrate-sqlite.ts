// SQLite migration script to create tables and seed data
import { sqlite, db } from './db-local';
import { 
  users, 
  states, 
  districts, 
  claims, 
  documents, 
  userSessions, 
  auditLog,
  workflowInstances,
  workflowSteps,
  workflowTransitions
} from "../shared/schema-sqlite";
import bcrypt from "bcrypt";
import { sql } from 'drizzle-orm';

const SALT_ROUNDS = 12;

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function migrateSQLite() {
  console.log('Creating SQLite tables...');
  
  // Create tables
  db.run(sql`
    CREATE TABLE IF NOT EXISTS states (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      code TEXT NOT NULL UNIQUE,
      language TEXT,
      created_at INTEGER DEFAULT (unixepoch())
    )
  `);

  db.run(sql`
    CREATE TABLE IF NOT EXISTS districts (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      state_id INTEGER NOT NULL REFERENCES states(id),
      created_at INTEGER DEFAULT (unixepoch())
    )
  `);

  db.run(sql`
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
    )
  `);

  db.run(sql`
    CREATE TABLE IF NOT EXISTS user_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      token TEXT NOT NULL UNIQUE,
      expires_at INTEGER NOT NULL,
      created_at INTEGER DEFAULT (unixepoch())
    )
  `);

  db.run(sql`
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
    )
  `);

  db.run(sql`
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
    )
  `);

  db.run(sql`
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
    )
  `);

  db.run(sql`
    CREATE TABLE IF NOT EXISTS workflow_instances (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      current_step TEXT NOT NULL DEFAULT 'upload',
      total_steps INTEGER NOT NULL DEFAULT 7,
      completed_steps INTEGER NOT NULL DEFAULT 0,
      user_id TEXT NOT NULL REFERENCES users(id),
      metadata TEXT,
      started_at INTEGER DEFAULT (unixepoch()),
      completed_at INTEGER,
      last_active_at INTEGER DEFAULT (unixepoch()),
      created_at INTEGER DEFAULT (unixepoch()),
      updated_at INTEGER DEFAULT (unixepoch())
    )
  `);

  db.run(sql`
    CREATE TABLE IF NOT EXISTS workflow_steps (
      id TEXT PRIMARY KEY,
      workflow_id TEXT NOT NULL REFERENCES workflow_instances(id),
      step_name TEXT NOT NULL,
      step_order INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      progress INTEGER DEFAULT 0,
      resource_id TEXT,
      resource_type TEXT,
      data TEXT,
      started_at INTEGER,
      completed_at INTEGER,
      notes TEXT,
      created_at INTEGER DEFAULT (unixepoch()),
      updated_at INTEGER DEFAULT (unixepoch())
    )
  `);

  db.run(sql`
    CREATE TABLE IF NOT EXISTS workflow_transitions (
      id TEXT PRIMARY KEY,
      workflow_id TEXT NOT NULL REFERENCES workflow_instances(id),
      from_step_id TEXT REFERENCES workflow_steps(id),
      to_step_id TEXT NOT NULL REFERENCES workflow_steps(id),
      transition_type TEXT NOT NULL,
      data TEXT,
      triggered_by TEXT REFERENCES users(id),
      created_at INTEGER DEFAULT (unixepoch())
    )
  `);

  console.log('SQLite tables created successfully');

  // Check if data already exists
  const existingStates = db.select().from(states).limit(1).all();
  if (existingStates.length > 0) {
    console.log('Data already exists, skipping seed');
    return;
  }

  console.log('Seeding SQLite database with initial data...');

  // Seed states
  const statesData = [
    { id: 1, name: "Madhya Pradesh", code: "MP", language: "Hindi" },
    { id: 2, name: "Odisha", code: "OR", language: "Odia" },
    { id: 3, name: "Telangana", code: "TG", language: "Telugu" },
    { id: 4, name: "Tripura", code: "TR", language: "Bengali" },
    { id: 5, name: "Maharashtra", code: "MH", language: "Marathi" },
    { id: 6, name: "Gujarat", code: "GJ", language: "Gujarati" },
  ];
  
  db.insert(states).values(statesData).run();

  // Seed districts  
  const districtsData = [
    { id: 1, name: "Mandla", stateId: 1 },
    { id: 2, name: "Balaghat", stateId: 1 },
    { id: 3, name: "Mayurbhanj", stateId: 2 },
    { id: 4, name: "Keonjhar", stateId: 2 },
    { id: 5, name: "Adilabad", stateId: 3 },
    { id: 6, name: "Warangal", stateId: 3 },
  ];

  db.insert(districts).values(districtsData).run();

  // Seed demo users with hashed passwords
  const demoUsersData = [
    {
      id: "admin-1", 
      username: "ministry.admin", 
      email: "admin@tribal.gov.in", 
      password: await hashPassword("admin123"), 
      fullName: "Ministry Administrator", 
      role: "ministry",
      stateId: null, 
      districtId: null, 
      isActive: true
    },
    {
      id: "state-1", 
      username: "mp.admin", 
      email: "mp@tribal.gov.in",
      password: await hashPassword("state123"), 
      fullName: "MP State Administrator", 
      role: "state",
      stateId: 1, 
      districtId: null, 
      isActive: true
    },
    {
      id: "district-1", 
      username: "district.officer", 
      email: "district@tribal.gov.in",
      password: await hashPassword("district123"), 
      fullName: "District Officer", 
      role: "district",
      stateId: 1, 
      districtId: 1, 
      isActive: true
    },
    {
      id: "village-1", 
      username: "village.officer", 
      email: "village@tribal.gov.in",
      password: await hashPassword("village123"), 
      fullName: "Village Officer", 
      role: "village",
      stateId: 1, 
      districtId: 1, 
      isActive: true
    }
  ];

  db.insert(users).values(demoUsersData).run();
  
  console.log('SQLite database seeded successfully!');
  console.log('Demo users created:');
  console.log('- ministry.admin / admin123 (Ministry Administrator)');
  console.log('- mp.admin / state123 (MP State Administrator)');
  console.log('- district.officer / district123 (District Officer)');
  console.log('- village.officer / village123 (Village Officer)');
}