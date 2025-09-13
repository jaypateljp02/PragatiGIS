import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, jsonb, decimal, boolean, customType } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Custom bytea type for binary file storage
const bytea = customType<{ 
  data: Buffer; 
  notNull: false; 
  default: false 
}>({
  dataType() {
    return 'bytea';
  },
  toDriver(value: Buffer) {
    return value;
  },
  fromDriver(value: unknown) {
    return value as Buffer;
  },
});

// States and Districts
export const states = pgTable("states", {
  id: integer("id").primaryKey(),
  name: text("name").notNull().unique(),
  code: varchar("code", { length: 2 }).notNull().unique(),
  language: text("language"),
  createdAt: timestamp("created_at").default(sql`NOW()`),
});

export const districts = pgTable("districts", {
  id: integer("id").primaryKey(),
  name: text("name").notNull(),
  stateId: integer("state_id").references(() => states.id).notNull(),
  createdAt: timestamp("created_at").default(sql`NOW()`),
});

// Enhanced Users with roles
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  fullName: text("full_name").notNull(),
  role: text("role").notNull(), // 'ministry', 'state', 'district', 'village'
  stateId: integer("state_id").references(() => states.id),
  districtId: integer("district_id").references(() => districts.id),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").default(sql`NOW()`),
  updatedAt: timestamp("updated_at").default(sql`NOW()`),
});

// User Sessions
export const userSessions = pgTable("user_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").default(sql`NOW()`),
});

// Claims with enhanced fields
export const claims = pgTable("claims", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  claimId: text("claim_id").notNull().unique(), // Human-readable ID like FRA-MH-2024-001234
  claimantName: text("claimant_name").notNull(),
  location: text("location").notNull(),
  district: text("district").notNull(),
  state: text("state").notNull(),
  area: decimal("area", { precision: 10, scale: 2 }).notNull(),
  landType: text("land_type").notNull(), // 'individual', 'community'
  status: text("status").notNull(), // 'pending', 'approved', 'rejected', 'under-review'
  dateSubmitted: timestamp("date_submitted").notNull(),
  dateProcessed: timestamp("date_processed"),
  assignedOfficer: varchar("assigned_officer").references(() => users.id),
  familyMembers: integer("family_members"),
  coordinates: jsonb("coordinates"), // GeoJSON for land boundaries
  notes: text("notes"),
  createdAt: timestamp("created_at").default(sql`NOW()`),
  updatedAt: timestamp("updated_at").default(sql`NOW()`),
});

// Documents
export const documents = pgTable("documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  claimId: varchar("claim_id").references(() => claims.id),
  filename: text("filename").notNull(),
  originalFilename: text("original_filename").notNull(),
  fileType: text("file_type").notNull(),
  fileSize: integer("file_size").notNull(),
  uploadPath: text("upload_path"), // Made nullable since files are stored in database now
  fileContent: bytea(), // Binary file content stored directly in database
  ocrStatus: text("ocr_status").notNull(), // 'pending', 'processing', 'completed', 'failed'
  ocrText: text("ocr_text"),
  extractedData: jsonb("extracted_data"),
  confidence: decimal("confidence", { precision: 5, scale: 2 }),
  reviewStatus: text("review_status").default('pending'), // 'pending', 'approved', 'rejected'
  reviewedBy: varchar("reviewed_by").references(() => users.id),
  uploadedBy: varchar("uploaded_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").default(sql`NOW()`),
  updatedAt: timestamp("updated_at").default(sql`NOW()`),
});

// Audit Log
export const auditLog = pgTable("audit_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  action: text("action").notNull(),
  resourceType: text("resource_type").notNull(),
  resourceId: text("resource_id").notNull(),
  changes: jsonb("changes"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").default(sql`NOW()`),
});

// Workflow Instances - Track individual workflow runs
export const workflowInstances = pgTable("workflow_instances", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(), // User-friendly name for the workflow
  description: text("description"),
  status: text("status").notNull().default('active'), // 'active', 'completed', 'cancelled', 'paused'
  currentStep: text("current_step").notNull().default('upload'), // 'upload', 'process', 'review', 'claims', 'map', 'dss', 'reports'
  totalSteps: integer("total_steps").notNull().default(7),
  completedSteps: integer("completed_steps").notNull().default(0),
  userId: varchar("user_id").references(() => users.id).notNull(),
  metadata: jsonb("metadata"), // Flexible storage for workflow-specific data
  startedAt: timestamp("started_at").default(sql`NOW()`),
  completedAt: timestamp("completed_at"),
  lastActiveAt: timestamp("last_active_at").default(sql`NOW()`),
  createdAt: timestamp("created_at").default(sql`NOW()`),
  updatedAt: timestamp("updated_at").default(sql`NOW()`),
});

// Workflow Steps - Track step completion and data flow
export const workflowSteps = pgTable("workflow_steps", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  workflowId: varchar("workflow_id").references(() => workflowInstances.id).notNull(),
  stepName: text("step_name").notNull(), // 'upload', 'process', 'review', 'claims', 'map', 'dss', 'reports'
  stepOrder: integer("step_order").notNull(),
  status: text("status").notNull().default('pending'), // 'pending', 'in_progress', 'completed', 'failed', 'skipped'
  progress: integer("progress").default(0), // 0-100 percentage
  resourceId: varchar("resource_id"), // ID of document, claim, etc. associated with this step
  resourceType: text("resource_type"), // 'document', 'claim', 'report', etc.
  data: jsonb("data"), // Step-specific data (OCR results, claim data, analysis results, etc.)
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").default(sql`NOW()`),
  updatedAt: timestamp("updated_at").default(sql`NOW()`),
});

// Workflow Transitions - Track data flow between steps
export const workflowTransitions = pgTable("workflow_transitions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  workflowId: varchar("workflow_id").references(() => workflowInstances.id).notNull(),
  fromStepId: varchar("from_step_id").references(() => workflowSteps.id),
  toStepId: varchar("to_step_id").references(() => workflowSteps.id).notNull(),
  transitionType: text("transition_type").notNull(), // 'auto', 'manual', 'conditional'
  data: jsonb("data"), // Data passed between steps
  triggeredBy: varchar("triggered_by").references(() => users.id),
  createdAt: timestamp("created_at").default(sql`NOW()`),
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
export type InsertWorkflowInstance = z.infer<typeof insertWorkflowInstanceSchema>;
export type WorkflowInstance = typeof workflowInstances.$inferSelect;
export type InsertWorkflowStep = z.infer<typeof insertWorkflowStepSchema>;
export type WorkflowStep = typeof workflowSteps.$inferSelect;
export type InsertWorkflowTransition = z.infer<typeof insertWorkflowTransitionSchema>;
export type WorkflowTransition = typeof workflowTransitions.$inferSelect;
export type LoginRequest = z.infer<typeof loginSchema>;
export type State = typeof states.$inferSelect;
export type District = typeof districts.$inferSelect;
export type AuditLogEntry = typeof auditLog.$inferSelect;
