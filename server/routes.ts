import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  loginSchema, 
  insertUserSchema, 
  insertClaimSchema,
  insertDocumentSchema 
} from "@shared/schema";
import { randomUUID } from "crypto";

// Authentication middleware
async function requireAuth(req: any, res: any, next: any) {
  try {
    const token = req.cookies.fra_session;
    if (!token) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const session = await storage.getSession(token);
    if (!session) {
      return res.status(401).json({ error: "Invalid or expired session" });
    }

    const user = await storage.getUser(session.userId);
    if (!user || !user.isActive) {
      return res.status(401).json({ error: "User not found or inactive" });
    }

    // Attach user to request for use in route handlers
    req.user = user;
    req.session = session;
    next();
  } catch (error) {
    console.error('Authentication middleware error:', error);
    res.status(500).json({ error: "Authentication error" });
  }
}

// Role-based authorization middleware
function requireRole(...allowedRoles: string[]) {
  return (req: any, res: any, next: any) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }
    
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    
    next();
  };
}

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Authentication routes
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = loginSchema.parse(req.body);
      
      // Use secure password verification
      const user = await storage.verifyPassword(username, password);
      if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      if (!user.isActive) {
        return res.status(401).json({ error: "Account is inactive" });
      }

      // Create session token
      const token = randomUUID();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      
      const session = await storage.createSession({
        userId: user.id,
        token,
        expiresAt
      });

      // Set secure HTTP-only cookie
      res.cookie('fra_session', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        path: '/'
      });

      // Log the login
      await storage.logAudit({
        userId: user.id,
        action: "login",
        resourceType: "user",
        resourceId: user.id,
        ipAddress: req.ip || null,
        userAgent: req.get('User-Agent') || null
      });

      // Return user data without token (token is in secure cookie)
      res.json({
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
          stateId: user.stateId,
          districtId: user.districtId
        },
        message: "Login successful"
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(400).json({ error: "Invalid request" });
    }
  });

  app.post("/api/auth/logout", async (req, res) => {
    try {
      const token = req.cookies.fra_session;
      if (token) {
        await storage.deleteSession(token);
      }
      
      // Clear the session cookie
      res.clearCookie('fra_session', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/'
      });
      
      res.json({ message: "Logged out successfully" });
    } catch (error) {
      res.status(500).json({ error: "Logout failed" });
    }
  });

  app.get("/api/auth/profile", async (req, res) => {
    try {
      const token = req.cookies.fra_session;
      if (!token) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const session = await storage.getSession(token);
      if (!session) {
        return res.status(401).json({ error: "Invalid or expired session" });
      }

      const user = await storage.getUser(session.userId);
      if (!user || !user.isActive) {
        return res.status(404).json({ error: "User not found or inactive" });
      }

      res.json({
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        stateId: user.stateId,
        districtId: user.districtId
      });
    } catch (error) {
      console.error('Profile error:', error);
      res.status(500).json({ error: "Failed to get profile" });
    }
  });

  // Claims management routes - Protected
  app.get("/api/claims", requireAuth, async (req, res) => {
    try {
      const { state, district, status, officer } = req.query;
      let claims = await storage.getAllClaims();

      if (state) {
        claims = await storage.getClaimsByState(state as string);
      } else if (district) {
        claims = await storage.getClaimsByDistrict(district as string);
      } else if (status) {
        claims = await storage.getClaimsByStatus(status as string);
      } else if (officer) {
        claims = await storage.getClaimsByOfficer(officer as string);
      }

      res.json(claims);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch claims" });
    }
  });

  app.get("/api/claims/:id", requireAuth, async (req, res) => {
    try {
      const claim = await storage.getClaim(req.params.id);
      if (!claim) {
        return res.status(404).json({ error: "Claim not found" });
      }
      res.json(claim);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch claim" });
    }
  });

  app.post("/api/claims", requireAuth, requireRole("ministry", "state", "district"), async (req, res) => {
    try {
      const claimData = insertClaimSchema.parse(req.body);
      const claim = await storage.createClaim(claimData);
      res.status(201).json(claim);
    } catch (error) {
      res.status(400).json({ error: "Invalid claim data" });
    }
  });

  app.patch("/api/claims/:id", requireAuth, requireRole("ministry", "state", "district"), async (req, res) => {
    try {
      const updates = req.body;
      const claim = await storage.updateClaim(req.params.id, updates);
      if (!claim) {
        return res.status(404).json({ error: "Claim not found" });
      }
      res.json(claim);
    } catch (error) {
      res.status(400).json({ error: "Failed to update claim" });
    }
  });

  app.post("/api/claims/:id/approve", requireAuth, requireRole("ministry", "state", "district"), async (req, res) => {
    try {
      const token = req.header("Authorization")?.replace("Bearer ", "");
      if (!token) {
        return res.status(401).json({ error: "No token provided" });
      }

      const session = await storage.getSession(token);
      if (!session) {
        return res.status(401).json({ error: "Invalid token" });
      }

      const claim = await storage.updateClaim(req.params.id, {
        status: "approved",
        dateProcessed: new Date(),
        assignedOfficer: session.userId
      });

      if (!claim) {
        return res.status(404).json({ error: "Claim not found" });
      }

      // Log the approval
      await storage.logAudit({
        userId: session.userId,
        action: "approve_claim",
        resourceType: "claim",
        resourceId: req.params.id,
        changes: { status: "approved" }
      });

      res.json(claim);
    } catch (error) {
      res.status(500).json({ error: "Failed to approve claim" });
    }
  });

  app.post("/api/claims/:id/reject", requireAuth, requireRole("ministry", "state", "district"), async (req, res) => {
    try {
      const token = req.header("Authorization")?.replace("Bearer ", "");
      if (!token) {
        return res.status(401).json({ error: "No token provided" });
      }

      const session = await storage.getSession(token);
      if (!session) {
        return res.status(401).json({ error: "Invalid token" });
      }

      const { reason } = req.body;
      const claim = await storage.updateClaim(req.params.id, {
        status: "rejected",
        dateProcessed: new Date(),
        assignedOfficer: session.userId,
        notes: reason || claim?.notes
      });

      if (!claim) {
        return res.status(404).json({ error: "Claim not found" });
      }

      // Log the rejection
      await storage.logAudit({
        userId: session.userId,
        action: "reject_claim",
        resourceType: "claim",
        resourceId: req.params.id,
        changes: { status: "rejected", reason }
      });

      res.json(claim);
    } catch (error) {
      res.status(500).json({ error: "Failed to reject claim" });
    }
  });

  // Document management routes - Protected
  app.get("/api/documents", requireAuth, async (req, res) => {
    try {
      const { claimId, status } = req.query;
      let documents = await storage.getAllDocuments();

      if (claimId) {
        documents = await storage.getDocumentsByClaim(claimId as string);
      } else if (status) {
        documents = await storage.getDocumentsByStatus(status as string);
      }

      res.json(documents);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch documents" });
    }
  });

  app.post("/api/documents", requireAuth, requireRole("ministry", "state", "district", "village"), async (req, res) => {
    try {
      const documentData = insertDocumentSchema.parse(req.body);
      const document = await storage.createDocument(documentData);
      res.status(201).json(document);
    } catch (error) {
      res.status(400).json({ error: "Invalid document data" });
    }
  });

  app.get("/api/documents/:id/ocr-results", requireAuth, async (req, res) => {
    try {
      const document = await storage.getDocument(req.params.id);
      if (!document) {
        return res.status(404).json({ error: "Document not found" });
      }
      
      res.json({
        id: document.id,
        filename: document.filename,
        ocrStatus: document.ocrStatus,
        ocrText: document.ocrText,
        extractedData: document.extractedData,
        confidence: document.confidence,
        reviewStatus: document.reviewStatus
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to get OCR results" });
    }
  });

  app.post("/api/documents/:id/correct-ocr", requireAuth, requireRole("ministry", "state", "district"), async (req, res) => {
    try {
      const { ocrText, extractedData, reviewStatus } = req.body;
      // User is already authenticated via middleware
      const user = req.user;
      const session = req.session;

      const document = await storage.updateDocument(req.params.id, {
        ocrText,
        extractedData,
        reviewStatus,
        reviewedBy: session.userId
      });

      if (!document) {
        return res.status(404).json({ error: "Document not found" });
      }

      res.json(document);
    } catch (error) {
      res.status(400).json({ error: "Failed to update OCR data" });
    }
  });

  // States and Districts
  app.get("/api/states", async (req, res) => {
    try {
      const states = await storage.getAllStates();
      res.json(states);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch states" });
    }
  });

  app.get("/api/states/:id/districts", async (req, res) => {
    try {
      const stateId = parseInt(req.params.id);
      const districts = await storage.getDistrictsByState(stateId);
      res.json(districts);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch districts" });
    }
  });

  app.get("/api/states/:stateId/dashboard", async (req, res) => {
    try {
      const { stateId } = req.params;
      const state = await storage.getState(parseInt(stateId));
      
      if (!state) {
        return res.status(404).json({ error: "State not found" });
      }

      const claims = await storage.getClaimsByState(state.name);
      const districts = await storage.getDistrictsByState(parseInt(stateId));
      
      const stats = {
        totalClaims: claims.length,
        pendingClaims: claims.filter(c => c.status === 'pending').length,
        approvedClaims: claims.filter(c => c.status === 'approved').length,
        rejectedClaims: claims.filter(c => c.status === 'rejected').length,
        totalArea: claims.reduce((sum, c) => sum + parseFloat(c.area.toString()), 0),
        districts: districts.length
      };

      res.json({
        state,
        stats,
        districts,
        recentClaims: claims.slice(-10)
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch state dashboard" });
    }
  });

  // Analytics routes  
  app.get("/api/analytics/processing-bottlenecks", async (req, res) => {
    try {
      const claims = await storage.getAllClaims();
      const documents = await storage.getAllDocuments();
      
      const bottlenecks = {
        pendingOCR: documents.filter(d => d.ocrStatus === 'pending').length,
        pendingReview: documents.filter(d => d.reviewStatus === 'pending').length,
        claimsByStatus: {
          pending: claims.filter(c => c.status === 'pending').length,
          'under-review': claims.filter(c => c.status === 'under-review').length,
          approved: claims.filter(c => c.status === 'approved').length,
          rejected: claims.filter(c => c.status === 'rejected').length
        },
        averageProcessingTime: 15 // Mock calculation
      };

      res.json(bottlenecks);
    } catch (error) {
      res.status(500).json({ error: "Failed to get bottleneck analysis" });
    }
  });

  // Audit logs
  app.get("/api/audit-log", async (req, res) => {
    try {
      const { resourceType, resourceId } = req.query;
      const logs = await storage.getAuditLog(
        resourceType as string, 
        resourceId as string
      );
      res.json(logs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch audit log" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
