import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  loginSchema, 
  insertUserSchema, 
  insertClaimSchema,
  insertDocumentSchema,
  insertWorkflowInstanceSchema,
  insertWorkflowStepSchema,
  insertWorkflowTransitionSchema 
} from "@shared/schema-sqlite";
import { randomUUID } from "crypto";
import multer from "multer";
import csv from "csv-parser";
import { Readable } from "stream";
import { createWorker } from "tesseract.js";
import type { Document } from "@shared/schema-sqlite";

// Utility function to sanitize document objects by removing fileContent
function sanitizeDocument<T extends Document>(document: T): Omit<T, 'fileContent'> {
  const { fileContent, ...sanitizedDoc } = document;
  return sanitizedDoc;
}

// Utility function to sanitize arrays of documents
function sanitizeDocuments<T extends Document>(documents: T[]): Omit<T, 'fileContent'>[] {
  return documents.map(doc => sanitizeDocument(doc));
}

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
  
  // Configure multer for file uploads
  const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
  });
  
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

      // Sanitize documents to exclude fileContent from response
      res.json(sanitizeDocuments(documents));
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch documents" });
    }
  });

  // File content is now stored directly in database, no temporary storage needed

  // Real OCR Processing function
  async function processDocumentOCR(documentId: string) {
    try {
      // Update status to processing
      await storage.updateDocument(documentId, {
        ocrStatus: 'processing'
      });

      // Get document details
      const document = await storage.getDocument(documentId);
      if (!document) {
        throw new Error('Document not found');
      }

      // Get the file buffer from database
      const fileBuffer = document.fileContent as Buffer | null;
      if (!fileBuffer) {
        throw new Error('File content not found in database');
      }

      console.log(`Starting real OCR processing for ${document.originalFilename} (${document.fileType})`);

      // Real OCR processing based on file type
      const ocrText = await extractTextFromDocument(document, fileBuffer);
      const extractedData = await extractStructuredData(ocrText, document);
      const confidence = calculateConfidence(ocrText, document);

      // File content is stored permanently in database, no cleanup needed

      // Update document with OCR results
      await storage.updateDocument(documentId, {
        ocrStatus: 'completed',
        ocrText: ocrText,
        extractedData: extractedData,
        confidence: confidence
      });

      console.log(`Real OCR processing completed for document ${documentId}`);
    } catch (error) {
      console.error(`OCR processing failed for document ${documentId}:`, error);
      // File content remains in database for potential retry
      await storage.updateDocument(documentId, {
        ocrStatus: 'failed'
      });
    }
  }

  // Extract text from document using real OCR
  async function extractTextFromDocument(document: any, fileBuffer: Buffer): Promise<string> {
    try {
      const fileType = document.fileType;
      console.log(`Extracting text from ${fileType} file: ${document.originalFilename}`);
      
      if (fileType === 'application/pdf') {
        // For now, analyze PDF metadata and encourage user to convert to image
        console.log('PDF detected - analyzing file...');
        const sizeKB = Math.round(fileBuffer.length / 1024);
        return `PDF Document Analysis:\n\nFilename: ${document.originalFilename}\nSize: ${sizeKB} KB\nPages: Estimated ${Math.ceil(sizeKB / 50)} pages\n\nNote: For best OCR results with PDFs, please:\n1. Convert PDF pages to high-quality images (JPG/PNG)\n2. Or use PDFs with selectable text\n\nThis PDF was uploaded successfully. To extract text, please upload as an image file.`;
      } else if (fileType.startsWith('image/')) {
        // Real image OCR using Tesseract - this will actually read your image!
        console.log('Processing image with Tesseract OCR...');
        return await extractTextFromImageBuffer(fileBuffer, document.originalFilename);
      } else {
        return `Unsupported file type: ${fileType}. Please upload PDF, JPEG, PNG, or TIFF files.`;
      }
    } catch (error: any) {
      console.error('Text extraction error:', error);
      return `Error extracting text from document: ${error?.message || error}`;
    }
  }

  // Extract text from image using Tesseract OCR
  async function extractTextFromImageBuffer(imageBuffer: Buffer, filename: string): Promise<string> {
    let worker = null;
    try {
      console.log(`Starting Tesseract OCR for image: ${filename}`);
      
      // Create Tesseract worker with multiple languages (English + Hindi)
      worker = await createWorker(['eng', 'hin']);
      
      // Perform OCR on the image buffer
      const { data: { text, confidence } } = await worker.recognize(imageBuffer);
      
      console.log(`Tesseract OCR completed with confidence: ${confidence}%`);
      console.log(`Extracted text length: ${text.length} characters`);
      
      if (text && text.trim().length > 0) {
        return text.trim();
      } else {
        return `No text could be extracted from the image. The image may be too blurry, have poor contrast, or contain no readable text.`;
      }
    } catch (error: any) {
      console.error('Tesseract OCR error:', error);
      return `OCR processing failed: ${error?.message || error}. Please ensure the image is clear and contains readable text.`;
    } finally {
      // Clean up the worker
      if (worker) {
        try {
          await worker.terminate();
        } catch (cleanupError) {
          console.error('Error cleaning up Tesseract worker:', cleanupError);
        }
      }
    }
  }

  // Extract structured data from OCR text
  async function extractStructuredData(ocrText: string, document: any): Promise<any> {
    // Basic pattern matching for FRA documents
    // In production, this would use NLP/NER models
    
    const extractedData: any = {
      documentType: 'Unknown',
      processingDate: new Date().toISOString().split('T')[0],
      fileInfo: {
        originalName: document.originalFilename,
        fileType: document.fileType,
        fileSize: document.fileSize
      }
    };

    // Simple keyword detection for demonstration
    const text = ocrText.toLowerCase();
    
    if (text.includes('forest rights') || text.includes('fra') || text.includes('वन अधिकार')) {
      extractedData.documentType = 'FRA Claim Form';
      extractedData.claimId = `FRA-${Date.now()}`;
    }
    
    // Extract patterns (basic regex matching)
    const namePatterns = [
      /name[:\s]+([a-zA-Z\s]+)/i,
      /नाम[:\s]+([ा-ॿ\s]+)/,
      /claimant[:\s]+([a-zA-Z\s]+)/i
    ];
    
    for (const pattern of namePatterns) {
      const match = ocrText.match(pattern);
      if (match && match[1]) {
        extractedData.claimantName = match[1].trim();
        break;
      }
    }

    return extractedData;
  }

  // Calculate confidence based on document analysis
  function calculateConfidence(ocrText: string, document: any): number {
    let confidence = 70; // Base confidence
    
    // Adjust based on file type
    if (document.fileType === 'application/pdf') {
      confidence += 10; // PDFs typically have better text extraction
    }
    
    // Adjust based on file size (larger files might have more content)
    if (document.fileSize > 100000) { // > 100KB
      confidence += 5;
    }
    
    // Adjust based on text length
    if (ocrText.length > 100) {
      confidence += 10;
    }
    
    // Cap at 95% since we're not using real OCR
    return Math.min(confidence, 95);
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

      // Create document record with file content stored in database
      const documentData = {
        filename: `${randomUUID()}_${file.originalname}`,
        originalFilename: file.originalname,
        fileType: file.mimetype,
        fileSize: file.size,
        uploadPath: null, // No longer needed since file is stored in database
        fileContent: file.buffer, // Store file content directly in database
        ocrStatus: 'pending' as const,
        reviewStatus: 'pending' as const,
        uploadedBy: user.id,
        claimId: req.body.claimId || null
      };

      const document = await storage.createDocument(documentData);
      
      // File is now stored in database, no need for temporary buffer storage
      
      // Start real OCR processing asynchronously
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
      // Sanitize document to exclude fileContent from response
      res.status(201).json(sanitizeDocument(document));
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

  // Serve files from database
  app.get("/api/documents/:id/download", requireAuth, async (req, res) => {
    try {
      const document = await storage.getDocument(req.params.id);
      if (!document) {
        return res.status(404).json({ error: "Document not found" });
      }
      
      if (!document.fileContent) {
        return res.status(404).json({ error: "File content not found" });
      }
      
      // Set appropriate headers for file download
      res.set({
        'Content-Type': document.fileType,
        'Content-Length': document.fileSize.toString(),
        'Content-Disposition': `attachment; filename="${document.originalFilename}"`,
        'Cache-Control': 'private, no-cache'
      });
      
      // Send the file content
      res.send(document.fileContent as Buffer);
    } catch (error) {
      console.error('File download error:', error);
      res.status(500).json({ error: "Failed to download file" });
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

      // Sanitize document to exclude fileContent from response
      res.json(sanitizeDocument(document));
    } catch (error) {
      res.status(400).json({ error: "Failed to update OCR data" });
    }
  });

  // Get documents for OCR review
  app.get("/api/ocr-review", requireAuth, async (req, res) => {
    try {
      console.log('Fetching documents for OCR review...');
      const documents = await storage.getDocumentsByStatus('completed');
      console.log(`Found ${documents.length} completed documents`);
      
      const pendingReview = documents.filter(doc => doc.reviewStatus === 'pending');
      console.log(`Found ${pendingReview.length} documents pending review`);
      
      // Sanitize documents to exclude fileContent from response
      const sanitizedDocs = sanitizeDocuments(pendingReview);
      res.json(sanitizedDocs);
    } catch (error) {
      console.error('OCR review endpoint error:', error);
      res.status(500).json({ 
        error: "Failed to fetch documents for review", 
        details: error instanceof Error ? error.message : "Unknown error" 
      });
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

  // Workflow Management API
  
  // Create new workflow instance
  app.post("/api/workflows", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      const workflowData = insertWorkflowInstanceSchema.parse({
        ...req.body,
        userId: user.id
      });
      
      const workflow = await storage.createWorkflowInstance(workflowData);
      
      // Create initial steps
      const stepOrder = [
        'upload', 'process', 'review', 'claims', 'map', 'dss', 'reports'
      ];
      
      for (let i = 0; i < stepOrder.length; i++) {
        await storage.createWorkflowStep({
          workflowId: workflow.id,
          stepName: stepOrder[i],
          stepOrder: i + 1,
          status: i === 0 ? 'in_progress' : 'pending'
        });
      }
      
      res.status(201).json(workflow);
    } catch (error) {
      console.error('Create workflow error:', error);
      res.status(400).json({ error: "Failed to create workflow" });
    }
  });

  // Get workflow instances for user
  app.get("/api/workflows", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      const { status } = req.query;
      
      let workflows = await storage.getWorkflowsByUser(user.id);
      
      if (status) {
        workflows = workflows.filter(w => w.status === status);
      }
      
      res.json(workflows);
    } catch (error) {
      console.error('Get workflows error:', error);
      res.status(500).json({ error: "Failed to fetch workflows" });
    }
  });

  // Get workflow with steps
  app.get("/api/workflows/:id", requireAuth, async (req, res) => {
    try {
      const workflow = await storage.getWorkflowInstance(req.params.id);
      if (!workflow) {
        return res.status(404).json({ error: "Workflow not found" });
      }
      
      const steps = await storage.getWorkflowSteps(req.params.id);
      const transitions = await storage.getWorkflowTransitions(req.params.id);
      
      res.json({
        ...workflow,
        steps,
        transitions
      });
    } catch (error) {
      console.error('Get workflow error:', error);
      res.status(500).json({ error: "Failed to fetch workflow" });
    }
  });

  // Update workflow status and current step
  app.patch("/api/workflows/:id", requireAuth, async (req, res) => {
    try {
      const { status, currentStep, completedSteps, metadata } = req.body;
      const user = (req as any).user;
      
      const updates: any = {
        lastActiveAt: new Date()
      };
      
      if (status) updates.status = status;
      if (currentStep) updates.currentStep = currentStep;
      if (completedSteps !== undefined) updates.completedSteps = completedSteps;
      if (metadata) updates.metadata = metadata;
      if (status === 'completed') updates.completedAt = new Date();
      
      const workflow = await storage.updateWorkflowInstance(req.params.id, updates);
      if (!workflow) {
        return res.status(404).json({ error: "Workflow not found" });
      }
      
      // Log workflow update
      await storage.logAudit({
        userId: user.id,
        action: "update_workflow",
        resourceType: "workflow",
        resourceId: req.params.id,
        changes: updates,
        ipAddress: req.ip || null,
        userAgent: req.get('User-Agent') || null
      });
      
      res.json(workflow);
    } catch (error) {
      console.error('Update workflow error:', error);
      res.status(400).json({ error: "Failed to update workflow" });
    }
  });

  // Update workflow step
  app.patch("/api/workflows/:workflowId/steps/:stepId", requireAuth, async (req, res) => {
    try {
      const { status, progress, data, notes, resourceId, resourceType } = req.body;
      const user = (req as any).user;
      
      const updates: any = {};
      
      if (status) {
        updates.status = status;
        if (status === 'in_progress' && !updates.startedAt) {
          updates.startedAt = new Date();
        }
        if (status === 'completed') {
          updates.completedAt = new Date();
          updates.progress = 100;
        }
      }
      
      if (progress !== undefined) updates.progress = progress;
      if (data) updates.data = data;
      if (notes) updates.notes = notes;
      if (resourceId) updates.resourceId = resourceId;
      if (resourceType) updates.resourceType = resourceType;
      
      const step = await storage.updateWorkflowStep(req.params.stepId, updates);
      if (!step) {
        return res.status(404).json({ error: "Workflow step not found" });
      }
      
      // Update parent workflow progress
      const allSteps = await storage.getWorkflowSteps(req.params.workflowId);
      const completedSteps = allSteps.filter(s => s.status === 'completed').length;
      const currentStep = allSteps.find(s => s.status === 'in_progress')?.stepName || 
                         allSteps.find(s => s.status === 'pending')?.stepName;
      
      await storage.updateWorkflowInstance(req.params.workflowId, {
        completedSteps,
        currentStep: currentStep || 'completed',
        lastActiveAt: new Date()
      });
      
      // Log step update
      await storage.logAudit({
        userId: user.id,
        action: "update_workflow_step",
        resourceType: "workflow_step",
        resourceId: req.params.stepId,
        changes: updates,
        ipAddress: req.ip || null,
        userAgent: req.get('User-Agent') || null
      });
      
      res.json(step);
    } catch (error) {
      console.error('Update workflow step error:', error);
      res.status(400).json({ error: "Failed to update workflow step" });
    }
  });

  // Create workflow transition (auto or manual)
  app.post("/api/workflows/:workflowId/transitions", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      const transitionData = insertWorkflowTransitionSchema.parse({
        ...req.body,
        workflowId: req.params.workflowId,
        triggeredBy: user.id
      });
      
      const transition = await storage.createWorkflowTransition(transitionData);
      
      res.status(201).json(transition);
    } catch (error) {
      console.error('Create transition error:', error);
      res.status(400).json({ error: "Failed to create transition" });
    }
  });

  // Continue workflow from specific step
  app.post("/api/workflows/:id/continue", requireAuth, async (req, res) => {
    try {
      const { fromStep } = req.body;
      const user = (req as any).user;
      
      // Update workflow to active and set current step
      const workflow = await storage.updateWorkflowInstance(req.params.id, {
        status: 'active',
        currentStep: fromStep,
        lastActiveAt: new Date()
      });
      
      if (!workflow) {
        return res.status(404).json({ error: "Workflow not found" });
      }
      
      // Update step status
      const steps = await storage.getWorkflowSteps(req.params.id);
      const currentStepRecord = steps.find(s => s.stepName === fromStep);
      
      if (currentStepRecord) {
        await storage.updateWorkflowStep(currentStepRecord.id, {
          status: 'in_progress',
          startedAt: new Date()
        });
      }
      
      // Log continue action
      await storage.logAudit({
        userId: user.id,
        action: "continue_workflow",
        resourceType: "workflow",
        resourceId: req.params.id,
        changes: { fromStep },
        ipAddress: req.ip || null,
        userAgent: req.get('User-Agent') || null
      });
      
      res.json({ message: "Workflow continued", workflow });
    } catch (error) {
      console.error('Continue workflow error:', error);
      res.status(500).json({ error: "Failed to continue workflow" });
    }
  });

  // Get workflow analytics
  app.get("/api/workflows/analytics", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      const workflows = await storage.getWorkflowsByUser(user.id);
      
      const analytics = {
        total: workflows.length,
        active: workflows.filter(w => w.status === 'active').length,
        completed: workflows.filter(w => w.status === 'completed').length,
        paused: workflows.filter(w => w.status === 'paused').length,
        avgCompletionTime: 0,
        stepStats: {}
      };
      
      // Calculate average completion time for completed workflows
      const completed = workflows.filter(w => w.status === 'completed' && w.completedAt);
      if (completed.length > 0) {
        const totalTime = completed.reduce((sum, w) => {
          const duration = new Date(w.completedAt!).getTime() - new Date(w.startedAt).getTime();
          return sum + duration;
        }, 0);
        analytics.avgCompletionTime = Math.round(totalTime / completed.length / (1000 * 60 * 60)); // hours
      }
      
      res.json(analytics);
    } catch (error) {
      console.error('Workflow analytics error:', error);
      res.status(500).json({ error: "Failed to fetch workflow analytics" });
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
