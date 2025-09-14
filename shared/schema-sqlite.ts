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

// Workflow Instances - Track individual workflow runs
export const workflowInstances = sqliteTable("workflow_instances", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(), // User-friendly name for the workflow
  description: text("description"),
  status: text("status").notNull().default('active'), // 'active', 'completed', 'cancelled', 'paused'
  currentStep: text("current_step").notNull().default('upload'), // 'upload', 'process', 'review', 'claims', 'map', 'dss', 'reports'
  totalSteps: integer("total_steps").notNull().default(7),
  completedSteps: integer("completed_steps").notNull().default(0),
  userId: text("user_id").references(() => users.id).notNull(),
  metadata: text("metadata", { mode: 'json' }), // Flexible storage for workflow-specific data
  startedAt: integer("started_at", { mode: 'timestamp' }).default(sql`(unixepoch())`),
  completedAt: integer("completed_at", { mode: 'timestamp' }),
  lastActiveAt: integer("last_active_at", { mode: 'timestamp' }).default(sql`(unixepoch())`),
  createdAt: integer("created_at", { mode: 'timestamp' }).default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

// Workflow Steps - Track step completion and data flow
export const workflowSteps = sqliteTable("workflow_steps", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  workflowId: text("workflow_id").references(() => workflowInstances.id).notNull(),
  stepName: text("step_name").notNull(), // 'upload', 'process', 'review', 'claims', 'map', 'dss', 'reports'
  stepOrder: integer("step_order").notNull(),
  status: text("status").notNull().default('pending'), // 'pending', 'in_progress', 'completed', 'failed', 'skipped'
  progress: integer("progress").default(0), // 0-100 percentage
  resourceId: text("resource_id"), // ID of document, claim, etc. associated with this step
  resourceType: text("resource_type"), // 'document', 'claim', 'report', etc.
  data: text("data", { mode: 'json' }), // Step-specific data (OCR results, claim data, analysis results, etc.)
  startedAt: integer("started_at", { mode: 'timestamp' }),
  completedAt: integer("completed_at", { mode: 'timestamp' }),
  notes: text("notes"),
  createdAt: integer("created_at", { mode: 'timestamp' }).default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

// Workflow Transitions - Track data flow between steps
export const workflowTransitions = sqliteTable("workflow_transitions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  workflowId: text("workflow_id").references(() => workflowInstances.id).notNull(),
  fromStepId: text("from_step_id").references(() => workflowSteps.id),
  toStepId: text("to_step_id").references(() => workflowSteps.id).notNull(),
  transitionType: text("transition_type").notNull(), // 'auto', 'manual', 'conditional'
  data: text("data", { mode: 'json' }), // Data passed between steps
  triggeredBy: text("triggered_by").references(() => users.id),
  createdAt: integer("created_at", { mode: 'timestamp' }).default(sql`(unixepoch())`),
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

export const insertWorkflowInstanceSchema = createInsertSchema(workflowInstances).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertWorkflowStepSchema = createInsertSchema(workflowSteps).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertWorkflowTransitionSchema = createInsertSchema(workflowTransitions).omit({
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
export type InsertWorkflowInstance = z.infer<typeof insertWorkflowInstanceSchema>;
export type WorkflowInstance = typeof workflowInstances.$inferSelect;
export type InsertWorkflowStep = z.infer<typeof insertWorkflowStepSchema>;
export type WorkflowStep = typeof workflowSteps.$inferSelect;
export type InsertWorkflowTransition = z.infer<typeof insertWorkflowTransitionSchema>;
export type WorkflowTransition = typeof workflowTransitions.$inferSelect;