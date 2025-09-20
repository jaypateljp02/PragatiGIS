import { 
  type User, 
  type InsertUser, 
  type Claim, 
  type InsertClaim, 
  type Document, 
  type InsertDocument,
  type UserSession,
  type InsertSession,
  type State,
  type District,
  type AuditLogEntry,
  type WorkflowInstance,
  type InsertWorkflowInstance,
  type WorkflowStep,
  type InsertWorkflowStep,
  type WorkflowTransition,
  type InsertWorkflowTransition,
  users,
  claims, 
  documents,
  userSessions,
  auditLog,
  states,
  districts,
  workflowInstances,
  workflowSteps,
  workflowTransitions
} from "@shared/schema-sqlite";

// Import the destructured schema objects based on database type
import { randomUUID } from "crypto";
import bcrypt from "bcrypt";
import { db } from "./db-local";
import { eq, and, sql } from "drizzle-orm";

export interface IStorage {
  // User management
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;
  deleteUser(id: string): Promise<boolean>;
  getUsersByRole(role: string): Promise<User[]>;
  getUsersByState(stateId: number): Promise<User[]>;
  verifyPassword(username: string, password: string): Promise<User | null>;

  // Session management
  createSession(session: InsertSession): Promise<UserSession>;
  getSession(token: string): Promise<UserSession | undefined>;
  deleteSession(token: string): Promise<boolean>;
  deleteUserSessions(userId: string): Promise<boolean>;

  // Claims management
  getAllClaims(): Promise<Claim[]>;
  getClaim(id: string): Promise<Claim | undefined>;
  getClaimsByState(state: string): Promise<Claim[]>;
  getClaimsByDistrict(district: string): Promise<Claim[]>;
  getClaimsByOfficer(officerId: string): Promise<Claim[]>;
  createClaim(claim: InsertClaim): Promise<Claim>;
  updateClaim(id: string, updates: Partial<Claim>): Promise<Claim | undefined>;
  deleteClaim(id: string): Promise<boolean>;
  getClaimsByStatus(status: string): Promise<Claim[]>;

  // Document management
  getAllDocuments(): Promise<Document[]>;
  getDocument(id: string): Promise<Document | undefined>;
  getDocumentsByClaim(claimId: string): Promise<Document[]>;
  getDocumentsByStatus(status: string): Promise<Document[]>;
  createDocument(document: InsertDocument): Promise<Document>;
  updateDocument(id: string, updates: Partial<Document>): Promise<Document | undefined>;
  deleteDocument(id: string): Promise<boolean>;

  // States and Districts
  getAllStates(): Promise<State[]>;
  getState(id: number): Promise<State | undefined>;
  getDistrictsByState(stateId: number): Promise<District[]>;
  getDistrict(id: number): Promise<District | undefined>;


  // Audit logging
  logAudit(entry: Omit<AuditLogEntry, 'id' | 'createdAt'>): Promise<AuditLogEntry>;
  getAuditLog(resourceType?: string, resourceId?: string): Promise<AuditLogEntry[]>;

  // Workflow management
  getWorkflowsByUser(userId: string): Promise<WorkflowInstance[]>;
  getWorkflow(id: string): Promise<WorkflowInstance | undefined>;
  createWorkflow(workflow: InsertWorkflowInstance): Promise<WorkflowInstance>;
  updateWorkflow(id: string, updates: Partial<WorkflowInstance>): Promise<WorkflowInstance | undefined>;
  deleteWorkflow(id: string): Promise<boolean>;
  getWorkflowSteps(workflowId: string): Promise<WorkflowStep[]>;
  createWorkflowStep(step: InsertWorkflowStep): Promise<WorkflowStep>;
  updateWorkflowStep(id: string, updates: Partial<WorkflowStep>): Promise<WorkflowStep | undefined>;
  createWorkflowTransition(transition: InsertWorkflowTransition): Promise<WorkflowTransition>;
}


// Add PostGIS extension and initialize database with seed data
export class DatabaseStorage implements IStorage {
  private static readonly SALT_ROUNDS = 12;

  constructor() {
    this.initializeDatabase();
  }

  private async initializeDatabase() {
    try {
      // For SQLite, no extensions needed
      // First run migration to ensure all tables exist
      const { migrateSQLite } = await import('./migrate-sqlite');
      await migrateSQLite();
      
      // Then seed initial data
      await this.seedInitialData();
      console.log('Database initialized successfully');
    } catch (error) {
      console.error('Database initialization error:', error);
    }
  }

  private async seedInitialData() {
    try {
      // Check if states already exist
      const existingStates = await db.select().from(states).limit(1);
      if (existingStates.length > 0) {
        return; // Data already seeded
      }

      // Seed states
      const statesData = [
        { id: 1, name: "Madhya Pradesh", code: "MP", language: "Hindi" },
        { id: 2, name: "Odisha", code: "OD", language: "Odia" },
        { id: 3, name: "Telangana", code: "TG", language: "Telugu" },
        { id: 4, name: "Tripura", code: "TR", language: "Bengali" },
        { id: 5, name: "Maharashtra", code: "MH", language: "Marathi" },
        { id: 6, name: "Gujarat", code: "GJ", language: "Gujarati" },
      ];
      
      await db.insert(states).values(statesData);

      // Seed districts  
      const districtsData = [
        { id: 1, name: "Mandla", stateId: 1 },
        { id: 2, name: "Balaghat", stateId: 1 },
        { id: 3, name: "Mayurbhanj", stateId: 2 },
        { id: 4, name: "Keonjhar", stateId: 2 },
        { id: 5, name: "Adilabad", stateId: 3 },
        { id: 6, name: "Warangal", stateId: 3 },
      ];

      await db.insert(districts).values(districtsData);

      // Seed demo users with hashed passwords
      const demoUsersData = [
        {
          id: "admin-1", username: "ministry.admin", email: "admin@tribal.gov.in", 
          password: await this.hashPassword("admin123"), fullName: "Ministry Administrator", role: "ministry",
          stateId: null, districtId: null, isActive: true
        },
        {
          id: "state-1", username: "mp.admin", email: "mp@tribal.gov.in",
          password: await this.hashPassword("state123"), fullName: "MP State Administrator", role: "state",
          stateId: 1, districtId: null, isActive: true
        },
        {
          id: "district-1", username: "district.officer", email: "district@tribal.gov.in",
          password: await this.hashPassword("district123"), fullName: "District Officer", role: "district",
          stateId: 1, districtId: 1, isActive: true
        },
        {
          id: "village-1", username: "village.officer", email: "village@tribal.gov.in",
          password: await this.hashPassword("village123"), fullName: "Village Officer", role: "village",
          stateId: 1, districtId: 1, isActive: true
        }
      ];

      await db.insert(users).values(demoUsersData);
      console.log('Demo users initialized with hashed passwords');
    } catch (error) {
      console.error('Failed to seed initial data:', error);
    }
  }

  private async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, DatabaseStorage.SALT_ROUNDS);
  }

  // User management
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(
      and(eq(users.username, username), eq(users.isActive, true))
    );
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(
      and(eq(users.email, email), eq(users.isActive, true))
    );
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const hashedPassword = await this.hashPassword(insertUser.password);
    const [user] = await db
      .insert(users)
      .values({ ...insertUser, password: hashedPassword })
      .returning();
    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user || undefined;
  }

  async deleteUser(id: string): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id));
    return (result.changes ?? 0) > 0;
  }

  async getUsersByRole(role: string): Promise<User[]> {
    return await db.select().from(users).where(eq(users.role, role));
  }

  async getUsersByState(stateId: number): Promise<User[]> {
    return await db.select().from(users).where(eq(users.stateId, stateId));
  }

  async verifyPassword(username: string, password: string): Promise<User | null> {
    const user = await this.getUserByUsername(username);
    if (!user || !user.isActive) {
      return null;
    }

    try {
      const isValidPassword = await bcrypt.compare(password, user.password);
      return isValidPassword ? user : null;
    } catch (error) {
      console.error('Password verification error:', error);
      return null;
    }
  }

  // Session management
  async createSession(insertSession: InsertSession): Promise<UserSession> {
    const [session] = await db
      .insert(userSessions)
      .values(insertSession)
      .returning();
    return session;
  }

  async getSession(token: string): Promise<UserSession | undefined> {
    const [session] = await db
      .select()
      .from(userSessions)
      .where(and(
        eq(userSessions.token, token),
        sql`${userSessions.expiresAt} > unixepoch()`
      ));
    return session || undefined;
  }

  async deleteSession(token: string): Promise<boolean> {
    const result = await db.delete(userSessions).where(eq(userSessions.token, token));
    return (result.changes ?? 0) > 0;
  }

  async deleteUserSessions(userId: string): Promise<boolean> {
    const result = await db.delete(userSessions).where(eq(userSessions.userId, userId));
    return (result.changes ?? 0) > 0;
  }

  // Claims management
  async getAllClaims(): Promise<Claim[]> {
    return await db.select().from(claims);
  }

  async getClaim(id: string): Promise<Claim | undefined> {
    const [claim] = await db.select().from(claims).where(eq(claims.id, id));
    return claim || undefined;
  }

  async getClaimsByState(state: string): Promise<Claim[]> {
    return await db.select().from(claims).where(eq(claims.state, state));
  }

  async getClaimsByDistrict(district: string): Promise<Claim[]> {
    return await db.select().from(claims).where(eq(claims.district, district));
  }

  async getClaimsByOfficer(officerId: string): Promise<Claim[]> {
    return await db.select().from(claims).where(eq(claims.assignedOfficer, officerId));
  }

  async createClaim(insertClaim: InsertClaim): Promise<Claim> {
    const [claim] = await db
      .insert(claims)
      .values(insertClaim)
      .returning();
    return claim;
  }

  async updateClaim(id: string, updates: Partial<Claim>): Promise<Claim | undefined> {
    const [claim] = await db
      .update(claims)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(claims.id, id))
      .returning();
    return claim || undefined;
  }

  async deleteClaim(id: string): Promise<boolean> {
    const result = await db.delete(claims).where(eq(claims.id, id));
    return (result.changes ?? 0) > 0;
  }

  async getClaimsByStatus(status: string): Promise<Claim[]> {
    return await db.select().from(claims).where(eq(claims.status, status));
  }

  // Document management
  async getAllDocuments(): Promise<Document[]> {
    return await db.select().from(documents);
  }

  async getDocument(id: string): Promise<Document | undefined> {
    const [document] = await db.select().from(documents).where(eq(documents.id, id));
    return document || undefined;
  }

  async getDocumentsByClaim(claimId: string): Promise<Document[]> {
    return await db.select().from(documents).where(eq(documents.claimId, claimId));
  }

  async getDocumentsByStatus(status: string): Promise<Document[]> {
    return await db.select().from(documents).where(eq(documents.ocrStatus, status));
  }

  async createDocument(insertDocument: InsertDocument): Promise<Document> {
    const [document] = await db
      .insert(documents)
      .values(insertDocument)
      .returning();
    return document;
  }

  async updateDocument(id: string, updates: Partial<Document>): Promise<Document | undefined> {
    const [document] = await db
      .update(documents)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(documents.id, id))
      .returning();
    return document || undefined;
  }

  async deleteDocument(id: string): Promise<boolean> {
    const result = await db.delete(documents).where(eq(documents.id, id));
    return (result.changes ?? 0) > 0;
  }

  // States and Districts
  async getAllStates(): Promise<State[]> {
    return await db.select().from(states);
  }

  async getState(id: number): Promise<State | undefined> {
    const [state] = await db.select().from(states).where(eq(states.id, id));
    return state || undefined;
  }

  async getDistrictsByState(stateId: number): Promise<District[]> {
    return await db.select().from(districts).where(eq(districts.stateId, stateId));
  }

  async getDistrict(id: number): Promise<District | undefined> {
    const [district] = await db.select().from(districts).where(eq(districts.id, id));
    return district || undefined;
  }


  // Audit logging
  async logAudit(entry: Omit<AuditLogEntry, 'id' | 'createdAt'>): Promise<AuditLogEntry> {
    const [auditEntry] = await db
      .insert(auditLog)
      .values(entry)
      .returning();
    return auditEntry;
  }

  async getAuditLog(resourceType?: string, resourceId?: string): Promise<AuditLogEntry[]> {
    if (resourceType && resourceId) {
      return await db.select().from(auditLog).where(and(
        eq(auditLog.resourceType, resourceType),
        eq(auditLog.resourceId, resourceId)
      )).orderBy(sql`${auditLog.createdAt} DESC`);
    } else if (resourceType) {
      return await db.select().from(auditLog).where(eq(auditLog.resourceType, resourceType)).orderBy(sql`${auditLog.createdAt} DESC`);
    } else if (resourceId) {
      return await db.select().from(auditLog).where(eq(auditLog.resourceId, resourceId)).orderBy(sql`${auditLog.createdAt} DESC`);
    }
    
    return await db.select().from(auditLog).orderBy(sql`${auditLog.createdAt} DESC`);
  }

  // Workflow management
  async getWorkflowsByUser(userId: string): Promise<WorkflowInstance[]> {
    return await db.select().from(workflowInstances).where(eq(workflowInstances.userId, userId));
  }

  async getWorkflow(id: string): Promise<WorkflowInstance | undefined> {
    const [workflow] = await db.select().from(workflowInstances).where(eq(workflowInstances.id, id));
    return workflow || undefined;
  }

  async createWorkflow(insertWorkflow: InsertWorkflowInstance): Promise<WorkflowInstance> {
    const [workflow] = await db
      .insert(workflowInstances)
      .values(insertWorkflow)
      .returning();
    return workflow;
  }

  async updateWorkflow(id: string, updates: Partial<WorkflowInstance>): Promise<WorkflowInstance | undefined> {
    const [workflow] = await db
      .update(workflowInstances)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(workflowInstances.id, id))
      .returning();
    return workflow || undefined;
  }

  async deleteWorkflow(id: string): Promise<boolean> {
    const result = await db.delete(workflowInstances).where(eq(workflowInstances.id, id));
    return (result.changes ?? 0) > 0;
  }

  async getWorkflowSteps(workflowId: string): Promise<WorkflowStep[]> {
    return await db.select().from(workflowSteps).where(eq(workflowSteps.workflowId, workflowId));
  }

  async createWorkflowStep(insertStep: InsertWorkflowStep): Promise<WorkflowStep> {
    const [step] = await db
      .insert(workflowSteps)
      .values(insertStep)
      .returning();
    return step;
  }

  async updateWorkflowStep(id: string, updates: Partial<WorkflowStep>): Promise<WorkflowStep | undefined> {
    const [step] = await db
      .update(workflowSteps)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(workflowSteps.id, id))
      .returning();
    return step || undefined;
  }

  async createWorkflowTransition(insertTransition: InsertWorkflowTransition): Promise<WorkflowTransition> {
    const [transition] = await db
      .insert(workflowTransitions)
      .values(insertTransition)
      .returning();
    return transition;
  }
}

export const storage = new DatabaseStorage();
