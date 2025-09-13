import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, real, blob } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// States and Districts
export const states = sqliteTable("states", {
  id: integer("id").primaryKey(),
  name: text("name").notNull().unique(),
  code: text("code", { length: 2 }).notNull().unique(),
  language: text("language"),
  createdAt: integer("created_at", { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

export const districts = sqliteTable("districts", {
  id: integer("id").primaryKey(),
  name: text("name").notNull(),
  stateId: integer("state_id").references(() => states.id).notNull(),
  createdAt: integer("created_at", { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

// Enhanced Users with roles
export const users = sqliteTable("users", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  fullName: text("full_name").notNull(),
  role: text("role").notNull(), // 'ministry', 'state', 'district', 'village'
  stateId: integer("state_id").references(() => states.id),
  districtId: integer("district_id").references(() => districts.id),
  isActive: integer("is_active", { mode: 'boolean' }).default(true),
  createdAt: integer("created_at", { mode: 'timestamp' }).default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

// User Sessions
export const userSessions = sqliteTable("user_sessions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").references(() => users.id).notNull(),
  token: text("token").notNull().unique(),
  expiresAt: integer("expires_at", { mode: 'timestamp' }).notNull(),
  createdAt: integer("created_at", { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

// Claims with enhanced fields
export const claims = sqliteTable("claims", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  claimId: text("claim_id").notNull().unique(), // Human-readable ID like FRA-MH-2024-001234
  claimantName: text("claimant_name").notNull(),
  location: text("location").notNull(),
  district: text("district").notNull(),
  state: text("state").notNull(),
  area: real("area").notNull(),
  landType: text("land_type").notNull(), // 'individual', 'community'
  status: text("status").notNull(), // 'pending', 'approved', 'rejected', 'under-review'
  dateSubmitted: integer("date_submitted", { mode: 'timestamp' }).notNull(),
  dateProcessed: integer("date_processed", { mode: 'timestamp' }),
  assignedOfficer: text("assigned_officer").references(() => users.id),
  familyMembers: integer("family_members"),
  coordinates: text("coordinates", { mode: 'json' }), // JSON for land boundaries
  notes: text("notes"),
  createdAt: integer("created_at", { mode: 'timestamp' }).default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

// Documents
export const documents = sqliteTable("documents", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  claimId: text("claim_id").references(() => claims.id),
  filename: text("filename").notNull(),
  originalFilename: text("original_filename").notNull(),
  fileType: text("file_type").notNull(),
  fileSize: integer("file_size").notNull(),
  uploadPath: text("upload_path"), // Made nullable since files are stored in database now
  fileContent: blob("file_content"), // Binary file content stored directly in database
  ocrStatus: text("ocr_status").notNull(), // 'pending', 'processing', 'completed', 'failed'
  ocrText: text("ocr_text"),
  extractedData: text("extracted_data", { mode: 'json' }),
  confidence: real("confidence"),
  reviewStatus: text("review_status").default('pending'), // 'pending', 'approved', 'rejected'
  reviewedBy: text("reviewed_by").references(() => users.id),
  uploadedBy: text("uploaded_by").references(() => users.id).notNull(),
  createdAt: integer("created_at", { mode: 'timestamp' }).default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

// Audit Log
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

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertClaimSchema = createInsertSchema(claims).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDocumentSchema = createInsertSchema(documents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSessionSchema = createInsertSchema(userSessions).omit({
  id: true,
  createdAt: true,
});

// Login schema
export const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertClaim = z.infer<typeof insertClaimSchema>;
export type Claim = typeof claims.$inferSelect;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Document = typeof documents.$inferSelect;
export type InsertSession = z.infer<typeof insertSessionSchema>;
export type UserSession = typeof userSessions.$inferSelect;
export type LoginRequest = z.infer<typeof loginSchema>;
export type State = typeof states.$inferSelect;
export type District = typeof districts.$inferSelect;
export type AuditLogEntry = typeof auditLog.$inferSelect;