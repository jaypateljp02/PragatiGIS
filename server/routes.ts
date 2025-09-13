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
import multer from "multer";
import csv from "csv-parser";
import { Readable } from "stream";

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
  app.get("/api/auth/me", requireAuth, async (req: any, res: any) => {
    try {
      // Return current user info if authenticated
      const user = {
        id: req.user.id,
        username: req.user.username,
        email: req.user.email,
        fullName: req.user.fullName,
        role: req.user.role,
        stateId: req.user.stateId,
        districtId: req.user.districtId,
        isActive: req.user.isActive
      };
      res.json({ user });
    } catch (error) {
      console.error('Get current user error:', error);
      res.status(500).json({ error: "Failed to get user info" });
    }
  });

  app.post("/api/auth/logout", requireAuth, async (req: any, res: any) => {
    try {
      // Invalidate the session
      await storage.deleteSession(req.session.token);
      
      // Clear the session cookie
      res.clearCookie('fra_session');
      
      // Log the logout
      await storage.logAudit({
        userId: req.user.id,
        action: "logout",
        resourceType: "session",
        resourceId: req.session.id,
        changes: null,
        ipAddress: req.ip || null,
        userAgent: req.get('User-Agent') || null
      });

      res.json({ message: "Logged out successfully" });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({ error: "Logout failed" });
    }
  });

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
        changes: null,
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

  // Dashboard stats API
  app.get("/api/dashboard/stats", requireAuth, async (req: any, res: any) => {
    try {
      const allClaims = await storage.getAllClaims();
      
      // Calculate statistics
      const totalClaims = allClaims.length;
      const approvedClaims = allClaims.filter(c => c.status === 'approved').length;
      const pendingClaims = allClaims.filter(c => c.status === 'pending').length;
      const underReviewClaims = allClaims.filter(c => c.status === 'under-review').length;
      const rejectedClaims = allClaims.filter(c => c.status === 'rejected').length;
      
      // Calculate total area
      const totalAreaNum = allClaims.reduce((sum, claim) => sum + parseFloat(claim.area.toString()), 0);
      const totalArea = totalAreaNum > 1000 
        ? `${(totalAreaNum / 1000).toFixed(2)}K hectares`
        : `${totalAreaNum.toFixed(2)} hectares`;
      
      // Get documents count (mock for now since we don't have documents yet)
      const totalDocuments = allClaims.length * 3; // Average 3 docs per claim
      const processedDocuments = Math.floor(totalDocuments * 0.75); // 75% processed
      
      const stats = {
        totalClaims,
        approvedClaims,
        pendingClaims,
        underReviewClaims,
        rejectedClaims,
        totalArea,
        totalDocuments,
        processedDocuments
      };
      
      res.json(stats);
    } catch (error) {
      console.error('Dashboard stats error:', error);
      res.status(500).json({ error: "Failed to fetch dashboard statistics" });
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
        changes: { status: "approved" },
        ipAddress: req.ip || null,
        userAgent: req.get('User-Agent') || null
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
      const existingClaim = await storage.getClaim(req.params.id);
      const claim = await storage.updateClaim(req.params.id, {
        status: "rejected",
        dateProcessed: new Date(),
        assignedOfficer: session.userId,
        notes: reason || existingClaim?.notes
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
        changes: { status: "rejected", reason },
        ipAddress: req.ip || null,
        userAgent: req.get('User-Agent') || null
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

  // OCR Processing function (simulated)
  async function processDocumentOCR(documentId: string) {
    try {
      // Update status to processing
      await storage.updateDocument(documentId, {
        ocrStatus: 'processing'
      });

      // Simulate OCR processing delay
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Simulate realistic OCR results based on document type
      const mockOCRResults = {
        hindi: {
          ocrText: "वन अधिकार दावा फॉर्म\nदावेदार का नाम: रमेश कुमार\nगाँव: देवगांव\nजिला: गड़चिरौली\nराज्य: महाराष्ट्र\nभूमि क्षेत्रफल: 12.50 हेक्टेयर\nपारिवारिक सदस्य: 6\nदावा प्रकार: व्यक्तिगत वन अधिकार",
          extractedData: {
            claimId: `FRA-MH-${Date.now()}`,
            claimantName: "रमेश कुमार",
            location: "देवगांव, गड़चिरौली",
            area: "12.50 हेक्टेयर",
            landType: "व्यक्तिगत",
            familyMembers: "6",
            dateSubmitted: new Date().toISOString().split('T')[0]
          },
          confidence: 89.5
        },
        english: {
          ocrText: "FOREST RIGHTS ACT CLAIM FORM\nClaimant Name: Sunita Devi\nVillage: Kheragarh\nDistrict: Balaghat\nState: Madhya Pradesh\nLand Area: 8.25 hectares\nFamily Members: 4\nClaim Type: Individual Forest Rights",
          extractedData: {
            claimId: `FRA-MP-${Date.now()}`,
            claimantName: "Sunita Devi",
            location: "Kheragarh, Balaghat",
            area: "8.25 hectares",
            landType: "Individual",
            familyMembers: "4",
            dateSubmitted: new Date().toISOString().split('T')[0]
          },
          confidence: 92.8
        }
      };

      // Randomly select between Hindi and English for demo
      const results = Math.random() > 0.5 ? mockOCRResults.hindi : mockOCRResults.english;

      // Update document with OCR results
      await storage.updateDocument(documentId, {
        ocrStatus: 'completed',
        ocrText: results.ocrText,
        extractedData: results.extractedData,
        confidence: results.confidence.toString()
      });

      console.log(`OCR processing completed for document ${documentId}`);
    } catch (error) {
      console.error(`OCR processing failed for document ${documentId}:`, error);
      await storage.updateDocument(documentId, {
        ocrStatus: 'failed'
      });
    }
  }

  // Document file upload endpoint
  app.post("/api/documents/upload", requireAuth, requireRole("ministry", "state", "district", "village"), upload.single("document"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const user = (req as any).user;
      const file = req.file;
      
      // Validate file type
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/tiff'];
      if (!allowedTypes.includes(file.mimetype)) {
        return res.status(400).json({ error: "Only PDF, JPEG, PNG, and TIFF files are allowed" });
      }

      // Create document record
      const documentData = {
        filename: `${randomUUID()}_${file.originalname}`,
        originalFilename: file.originalname,
        fileType: file.mimetype,
        fileSize: file.size,
        uploadPath: `/uploads/${randomUUID()}_${file.originalname}`, // In production, save to actual storage
        ocrStatus: 'pending' as const,
        reviewStatus: 'pending' as const,
        uploadedBy: user.id,
        claimId: req.body.claimId || null
      };

      const document = await storage.createDocument(documentData);
      
      // Start OCR processing asynchronously
      setImmediate(() => processDocumentOCR(document.id).catch(console.error));
      
      res.status(201).json({
        id: document.id,
        filename: document.filename,
        originalFilename: document.originalFilename,
        status: 'uploaded',
        message: 'Document uploaded successfully, OCR processing started'
      });
    } catch (error) {
      console.error('Document upload error:', error);
      res.status(500).json({ error: "Failed to upload document" });
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
      const user = (req as any).user;
      const session = (req as any).session;

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

  // Get documents for OCR review
  app.get("/api/ocr-review", requireAuth, async (req, res) => {
    try {
      const documents = await storage.getDocumentsByStatus('completed');
      const pendingReview = documents.filter(doc => doc.reviewStatus === 'pending');
      res.json(pendingReview);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch documents for review" });
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

  // Bulk Claims Import/Export Routes
  const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
  });

  // Data standardization utilities
  function standardizeClaimData(rawData: any) {
    const standardized = {
      claimId: rawData.claim_id || rawData.claimId || `FRA-${rawData.state}-${Date.now()}`,
      claimantName: rawData.claimant_name || rawData.claimantName || rawData.name,
      location: rawData.location || rawData.village || rawData.village_name,
      district: rawData.district || rawData.district_name,
      state: rawData.state || rawData.state_name,
      area: (rawData.area || rawData.area_hectares || rawData.land_area || '0').toString(),
      landType: (rawData.land_type || rawData.landType || 'individual').toLowerCase(),
      status: (rawData.status || 'pending').toLowerCase(),
      dateSubmitted: rawData.date_submitted ? new Date(rawData.date_submitted) : new Date(),
      familyMembers: parseInt(rawData.family_members || rawData.familyMembers || 0) || null,
      coordinates: rawData.coordinates ? JSON.parse(rawData.coordinates) : null,
      notes: rawData.notes || rawData.remarks || null
    };

    // Validate with proper schema
    try {
      const validatedData = insertClaimSchema.parse(standardized);
      return validatedData;
    } catch (error) {
      throw new Error(`Invalid claim data: ${error instanceof Error ? error.message : 'Unknown validation error'}`);
    }
  }

  // Bulk claims import from CSV/Excel
  app.post("/api/claims/bulk-import", requireAuth, requireRole("ministry", "state", "district"), upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      
      // Validate file type
      if (req.file.mimetype !== 'text/csv' && !req.file.originalname?.toLowerCase().endsWith('.csv')) {
        return res.status(400).json({ error: "Only CSV files are allowed" });
      }

      const user = (req as any).user;
      const results: any[] = [];
      const errors: string[] = [];
      let successCount = 0;
      let errorCount = 0;

      // Parse CSV data
      const csvData: any[] = [];
      const readable = Readable.from(req.file.buffer.toString());
      
      await new Promise((resolve, reject) => {
        readable
          .pipe(csv())
          .on('data', (data) => csvData.push(data))
          .on('end', resolve)
          .on('error', reject);
      });

      // Process each row
      for (const row of csvData) {
        try {
          const standardizedData = standardizeClaimData(row);
          
          // Role-based filtering: users can only import data for their jurisdiction
          if (user.role === 'state' && user.stateId) {
            const userState = await storage.getState(user.stateId);
            if (userState && standardizedData.state !== userState.name) {
              errors.push(`Row ${csvData.indexOf(row) + 1}: Cannot import claim for ${standardizedData.state} - outside jurisdiction`);
              errorCount++;
              continue;
            }
          } else if (user.role === 'district' && user.districtId) {
            const userDistrict = await storage.getDistrict(user.districtId);
            if (userDistrict && standardizedData.district !== userDistrict.name) {
              errors.push(`Row ${csvData.indexOf(row) + 1}: Cannot import claim for ${standardizedData.district} - outside jurisdiction`);
              errorCount++;
              continue;
            }
          }

          const claim = await storage.createClaim(standardizedData);
          results.push({ row: csvData.indexOf(row) + 1, status: 'success', claimId: claim.id });
          successCount++;

          // Log the import
          await storage.logAudit({
            userId: user.id,
            action: "bulk_import_claim",
            resourceType: "claim",
            resourceId: claim.id,
            changes: { imported: true, source: 'csv' },
            ipAddress: req.ip || null,
            userAgent: req.get('User-Agent') || null
          });
        } catch (error) {
          const errorMsg = `Row ${csvData.indexOf(row) + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          errors.push(errorMsg);
          errorCount++;
        }
      }

      res.json({
        message: `Import completed: ${successCount} successful, ${errorCount} failed`,
        summary: { total: csvData.length, successful: successCount, failed: errorCount },
        results,
        errors: errors.slice(0, 50) // Limit error details
      });
    } catch (error) {
      console.error('Bulk import error:', error);
      res.status(500).json({ error: "Failed to import claims data" });
    }
  });

  // Export claims to CSV
  app.get("/api/claims/export", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      let claims = await storage.getAllClaims();
      
      // Role-based filtering
      if (user.role === 'state' && user.stateId) {
        const userState = await storage.getState(user.stateId);
        if (userState) {
          claims = claims.filter(claim => claim.state === userState.name);
        }
      } else if (user.role === 'district' && user.districtId) {
        const userDistrict = await storage.getDistrict(user.districtId);
        if (userDistrict) {
          claims = claims.filter(claim => claim.district === userDistrict.name);
        }
      }

      // Convert to CSV format
      const csvHeader = 'ID,Claim ID,Claimant Name,Location,District,State,Area (hectares),Land Type,Status,Date Submitted,Date Processed,Family Members,Notes\n';
      const csvRows = claims.map(claim => [
        claim.id,
        claim.claimId,
        claim.claimantName,
        claim.location,
        claim.district,
        claim.state,
        claim.area,
        claim.landType,
        claim.status,
        claim.dateSubmitted.toISOString().split('T')[0],
        claim.dateProcessed ? claim.dateProcessed.toISOString().split('T')[0] : '',
        claim.familyMembers || '',
        (claim.notes || '').replace(/"/g, '""') // Escape quotes
      ].map(field => `"${field}"`).join(','));

      const csvContent = csvHeader + csvRows.join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="fra-claims-${new Date().toISOString().split('T')[0]}.csv"`);
      res.send(csvContent);

      // Log the export
      await storage.logAudit({
        userId: user.id,
        action: "export_claims",
        resourceType: "claims",
        resourceId: "bulk",
        changes: { exported_count: claims.length },
        ipAddress: req.ip || null,
        userAgent: req.get('User-Agent') || null
      });
    } catch (error) {
      console.error('Export error:', error);
      res.status(500).json({ error: "Failed to export claims data" });
    }
  });

  // Bulk claims status update
  app.post("/api/claims/bulk-action", requireAuth, requireRole("ministry", "state", "district"), async (req, res) => {
    try {
      const { claimIds, action, reason } = req.body;
      const user = (req as any).user;
      
      if (!claimIds || !Array.isArray(claimIds) || claimIds.length === 0) {
        return res.status(400).json({ error: "No claim IDs provided" });
      }

      if (!['approve', 'reject', 'under-review'].includes(action)) {
        return res.status(400).json({ error: "Invalid action" });
      }

      const results = [];
      const errors = [];

      for (const claimId of claimIds) {
        try {
          const updates: any = {
            status: action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'under-review',
            assignedOfficer: user.id
          };

          if (action === 'approve' || action === 'reject') {
            updates.dateProcessed = new Date();
          }

          if (action === 'reject' && reason) {
            updates.notes = reason;
          }

          const claim = await storage.updateClaim(claimId, updates);
          if (claim) {
            results.push({ claimId, status: 'success' });
            
            // Log the bulk action
            await storage.logAudit({
              userId: user.id,
              action: `bulk_${action}_claim`,
              resourceType: "claim",
              resourceId: claimId,
              changes: { status: updates.status, reason },
              ipAddress: req.ip || null,
              userAgent: req.get('User-Agent') || null
            });
          } else {
            errors.push({ claimId, error: 'Claim not found' });
          }
        } catch (error) {
          errors.push({ claimId, error: error instanceof Error ? error.message : 'Unknown error' });
        }
      }

      res.json({
        message: `Bulk action completed: ${results.length} successful, ${errors.length} failed`,
        results,
        errors
      });
    } catch (error) {
      console.error('Bulk action error:', error);
      res.status(500).json({ error: "Failed to perform bulk action" });
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
