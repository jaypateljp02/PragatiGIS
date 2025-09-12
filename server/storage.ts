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
  type AuditLogEntry
} from "@shared/schema";
import { randomUUID } from "crypto";
import bcrypt from "bcrypt";

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
}

export class MemStorage implements IStorage {
  private users: Map<string, User> = new Map();
  private sessions: Map<string, UserSession> = new Map();
  private claims: Map<string, Claim> = new Map();
  private documents: Map<string, Document> = new Map();
  private auditLog: AuditLogEntry[] = [];
  private states: Map<number, State> = new Map();
  private districts: Map<number, District> = new Map();
  private static readonly SALT_ROUNDS = 12;

  constructor() {
    // Initialize synchronously - password hashing will happen on first access
    this.initializeMockDataSync();
    // Initialize hashed passwords asynchronously
    this.initializeMockData();
  }

  private initializeMockDataSync() {
    // Initialize states
    const statesData = [
      { id: 1, name: "Madhya Pradesh", code: "MP", language: "Hindi", createdAt: new Date() },
      { id: 2, name: "Odisha", code: "OR", language: "Odia", createdAt: new Date() },
      { id: 3, name: "Telangana", code: "TG", language: "Telugu", createdAt: new Date() },
      { id: 4, name: "Tripura", code: "TR", language: "Bengali", createdAt: new Date() },
      { id: 5, name: "Maharashtra", code: "MH", language: "Marathi", createdAt: new Date() },
      { id: 6, name: "Gujarat", code: "GJ", language: "Gujarati", createdAt: new Date() },
    ];
    
    statesData.forEach(state => this.states.set(state.id, state));

    // Initialize districts  
    const districtsData = [
      { id: 1, name: "Mandla", stateId: 1, createdAt: new Date() },
      { id: 2, name: "Balaghat", stateId: 1, createdAt: new Date() },
      { id: 3, name: "Mayurbhanj", stateId: 2, createdAt: new Date() },
      { id: 4, name: "Keonjhar", stateId: 2, createdAt: new Date() },
      { id: 5, name: "Adilabad", stateId: 3, createdAt: new Date() },
      { id: 6, name: "Warangal", stateId: 3, createdAt: new Date() },
    ];

    districtsData.forEach(district => this.districts.set(district.id, district));
  }

  private async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, MemStorage.SALT_ROUNDS);
  }

  private async initializeMockData() {
    // Initialize demo users with hashed passwords
    const demoUsersData = [
      {
        id: "admin-1", username: "ministry.admin", email: "admin@tribal.gov.in", 
        password: "admin123", fullName: "Ministry Administrator", role: "ministry",
        stateId: null, districtId: null, isActive: true, 
        createdAt: new Date(), updatedAt: new Date()
      },
      {
        id: "state-1", username: "mp.admin", email: "mp@tribal.gov.in",
        password: "state123", fullName: "MP State Administrator", role: "state",
        stateId: 1, districtId: null, isActive: true,
        createdAt: new Date(), updatedAt: new Date()
      },
      {
        id: "district-1", username: "district.officer", email: "district@tribal.gov.in",
        password: "district123", fullName: "District Officer", role: "district",
        stateId: 1, districtId: 1, isActive: true,
        createdAt: new Date(), updatedAt: new Date()
      },
      {
        id: "village-1", username: "village.officer", email: "village@tribal.gov.in",
        password: "village123", fullName: "Village Officer", role: "village",
        stateId: 1, districtId: 1, isActive: true,
        createdAt: new Date(), updatedAt: new Date()
      }
    ];

    // Hash passwords for demo users and replace existing users
    try {
      for (const userData of demoUsersData) {
        const hashedPassword = await this.hashPassword(userData.password);
        const user = { ...userData, password: hashedPassword };
        this.users.set(user.id, user);
      }
      console.log('Demo users initialized with hashed passwords');
    } catch (error) {
      console.error('Failed to hash demo user passwords:', error);
    }
  }

  // User management
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.username === username);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.email === email);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const hashedPassword = await this.hashPassword(insertUser.password);
    const user: User = { 
      ...insertUser, 
      id, 
      password: hashedPassword,
      createdAt: new Date(), 
      updatedAt: new Date(),
      stateId: insertUser.stateId || null,
      districtId: insertUser.districtId || null,
      isActive: insertUser.isActive ?? true
    };
    this.users.set(id, user);
    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    const updatedUser = { ...user, ...updates, updatedAt: new Date() };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async deleteUser(id: string): Promise<boolean> {
    return this.users.delete(id);
  }

  async getUsersByRole(role: string): Promise<User[]> {
    return Array.from(this.users.values()).filter(user => user.role === role);
  }

  async getUsersByState(stateId: number): Promise<User[]> {
    return Array.from(this.users.values()).filter(user => user.stateId === stateId);
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
    const id = randomUUID();
    const session: UserSession = { ...insertSession, id, createdAt: new Date() };
    this.sessions.set(session.token, session);
    return session;
  }

  async getSession(token: string): Promise<UserSession | undefined> {
    const session = this.sessions.get(token);
    if (session && session.expiresAt > new Date()) {
      return session;
    }
    if (session) {
      this.sessions.delete(token);
    }
    return undefined;
  }

  async deleteSession(token: string): Promise<boolean> {
    return this.sessions.delete(token);
  }

  async deleteUserSessions(userId: string): Promise<boolean> {
    const userSessions = Array.from(this.sessions.entries()).filter(
      ([_, session]) => session.userId === userId
    );
    userSessions.forEach(([token]) => this.sessions.delete(token));
    return userSessions.length > 0;
  }

  // Claims management (using existing mock data)
  async getAllClaims(): Promise<Claim[]> {
    return Array.from(this.claims.values());
  }

  async getClaim(id: string): Promise<Claim | undefined> {
    return this.claims.get(id);
  }

  async getClaimsByState(state: string): Promise<Claim[]> {
    return Array.from(this.claims.values()).filter(claim => claim.state === state);
  }

  async getClaimsByDistrict(district: string): Promise<Claim[]> {
    return Array.from(this.claims.values()).filter(claim => claim.district === district);
  }

  async getClaimsByOfficer(officerId: string): Promise<Claim[]> {
    return Array.from(this.claims.values()).filter(claim => claim.assignedOfficer === officerId);
  }

  async createClaim(insertClaim: InsertClaim): Promise<Claim> {
    const id = randomUUID();
    const claim: Claim = { 
      ...insertClaim, 
      id, 
      createdAt: new Date(), 
      updatedAt: new Date(),
      dateProcessed: insertClaim.dateProcessed || null,
      assignedOfficer: insertClaim.assignedOfficer || null,
      familyMembers: insertClaim.familyMembers || null,
      coordinates: insertClaim.coordinates || null,
      notes: insertClaim.notes || null
    };
    this.claims.set(id, claim);
    return claim;
  }

  async updateClaim(id: string, updates: Partial<Claim>): Promise<Claim | undefined> {
    const claim = this.claims.get(id);
    if (!claim) return undefined;
    
    const updatedClaim = { ...claim, ...updates, updatedAt: new Date() };
    this.claims.set(id, updatedClaim);
    return updatedClaim;
  }

  async deleteClaim(id: string): Promise<boolean> {
    return this.claims.delete(id);
  }

  async getClaimsByStatus(status: string): Promise<Claim[]> {
    return Array.from(this.claims.values()).filter(claim => claim.status === status);
  }

  // Document management
  async getAllDocuments(): Promise<Document[]> {
    return Array.from(this.documents.values());
  }

  async getDocument(id: string): Promise<Document | undefined> {
    return this.documents.get(id);
  }

  async getDocumentsByClaim(claimId: string): Promise<Document[]> {
    return Array.from(this.documents.values()).filter(doc => doc.claimId === claimId);
  }

  async getDocumentsByStatus(status: string): Promise<Document[]> {
    return Array.from(this.documents.values()).filter(doc => doc.ocrStatus === status);
  }

  async createDocument(insertDocument: InsertDocument): Promise<Document> {
    const id = randomUUID();
    const document: Document = { 
      ...insertDocument, 
      id, 
      createdAt: new Date(), 
      updatedAt: new Date(),
      claimId: insertDocument.claimId || null,
      ocrText: insertDocument.ocrText || null,
      extractedData: insertDocument.extractedData || null,
      confidence: insertDocument.confidence || null,
      reviewStatus: insertDocument.reviewStatus || "pending",
      reviewedBy: insertDocument.reviewedBy || null
    };
    this.documents.set(id, document);
    return document;
  }

  async updateDocument(id: string, updates: Partial<Document>): Promise<Document | undefined> {
    const document = this.documents.get(id);
    if (!document) return undefined;
    
    const updatedDocument = { ...document, ...updates, updatedAt: new Date() };
    this.documents.set(id, updatedDocument);
    return updatedDocument;
  }

  async deleteDocument(id: string): Promise<boolean> {
    return this.documents.delete(id);
  }

  // States and Districts
  async getAllStates(): Promise<State[]> {
    return Array.from(this.states.values());
  }

  async getState(id: number): Promise<State | undefined> {
    return this.states.get(id);
  }

  async getDistrictsByState(stateId: number): Promise<District[]> {
    return Array.from(this.districts.values()).filter(district => district.stateId === stateId);
  }

  async getDistrict(id: number): Promise<District | undefined> {
    return this.districts.get(id);
  }

  // Audit logging
  async logAudit(entry: Omit<AuditLogEntry, 'id' | 'createdAt'>): Promise<AuditLogEntry> {
    const auditEntry: AuditLogEntry = {
      ...entry,
      id: randomUUID(),
      createdAt: new Date(),
    };
    this.auditLog.push(auditEntry);
    return auditEntry;
  }

  async getAuditLog(resourceType?: string, resourceId?: string): Promise<AuditLogEntry[]> {
    let logs = [...this.auditLog];
    
    if (resourceType) {
      logs = logs.filter(log => log.resourceType === resourceType);
    }
    
    if (resourceId) {
      logs = logs.filter(log => log.resourceId === resourceId);
    }
    
    return logs.sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
  }
}

export const storage = new MemStorage();
