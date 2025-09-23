import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { DataImportService } from "./data-import";
import { GovernmentAPIService } from "./govt-api-service";
import { 
  loginSchema, 
  insertUserSchema, 
  insertClaimSchema,
  insertDocumentSchema,
  insertWorkflowInstanceSchema,
  insertWorkflowTransitionSchema
} from "@shared/schema-sqlite";
import { analyzeDocument, classifyDocument, extractText, summarizeDocument } from "./gemini-ai-service";
import { z } from 'zod';
import { randomUUID } from "crypto";
import multer from "multer";
import csv from "csv-parser";
import { Readable } from "stream";
import { createWorker, PSM } from "tesseract.js";
import type { Document } from "@shared/schema-sqlite";
import fs from "fs";
import path from "path";

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

  // Avatar upload route
  app.post("/api/user/avatar", requireAuth, upload.single('avatar'), async (req: any, res: any) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      // Validate file type
      if (!req.file.mimetype.startsWith('image/')) {
        return res.status(400).json({ error: "File must be an image" });
      }

      // Validate file size (2MB max)
      if (req.file.size > 2 * 1024 * 1024) {
        return res.status(400).json({ error: "File size must be less than 2MB" });
      }

      // Generate unique filename
      const fileExtension = path.extname(req.file.originalname);
      const fileName = `${req.user.id}_${Date.now()}${fileExtension}`;
      const filePath = path.join('uploads', 'avatars', fileName);

      // Ensure uploads/avatars directory exists
      const uploadsDir = path.join('uploads', 'avatars');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      // Save file to disk
      fs.writeFileSync(filePath, req.file.buffer);

      // Update user record with avatar path
      const updatedUser = await storage.updateUser(req.user.id, { avatar: filePath });
      
      if (!updatedUser) {
        // Clean up file if user update failed
        fs.unlinkSync(filePath);
        return res.status(500).json({ error: "Failed to update user record" });
      }

      res.json({ 
        message: "Avatar uploaded successfully",
        avatarUrl: `/api/user/avatar/${req.user.id}`
      });
    } catch (error) {
      console.error('Avatar upload error:', error);
      res.status(500).json({ error: "Failed to upload avatar" });
    }
  });

  // Avatar retrieval route
  app.get("/api/user/avatar/:userId", async (req: any, res: any) => {
    try {
      const { userId } = req.params;
      
      // Get user to find avatar path
      const user = await storage.getUser(userId);
      if (!user || !user.avatar) {
        return res.status(404).json({ error: "Avatar not found" });
      }

      // Check if file exists
      if (!fs.existsSync(user.avatar)) {
        return res.status(404).json({ error: "Avatar file not found" });
      }

      // Get file extension to set correct content type
      const fileExtension = path.extname(user.avatar).toLowerCase();
      const contentType = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg', 
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp'
      }[fileExtension] || 'image/jpeg';

      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
      res.sendFile(path.resolve(user.avatar));
    } catch (error) {
      console.error('Avatar retrieval error:', error);
      res.status(500).json({ error: "Failed to retrieve avatar" });
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
      
      // Get real documents count from OCR processing
      const allDocuments = await storage.getAllDocuments();
      const totalDocuments = allDocuments.length;
      const processedDocuments = allDocuments.filter(doc => doc.ocrStatus === 'completed').length;
      const failedDocuments = allDocuments.filter(doc => doc.ocrStatus === 'failed').length;
      const processingDocuments = allDocuments.filter(doc => doc.ocrStatus === 'processing').length;
      
      const stats = {
        totalClaims,
        approvedClaims,
        pendingClaims,
        underReviewClaims,
        rejectedClaims,
        totalArea,
        totalDocuments,
        processedDocuments,
        failedDocuments,
        processingDocuments
      };
      
      res.json(stats);
    } catch (error) {
      console.error('Dashboard stats error:', error);
      res.status(500).json({ error: "Failed to fetch dashboard statistics" });
    }
  });

  // AI Document Classification API - Classify uploaded documents using Gemini AI
  app.post("/api/ai/classify-document", requireAuth, upload.single('document'), async (req: any, res: any) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No document uploaded" });
      }

      // Validate file type
      if (!req.file.mimetype.startsWith('image/')) {
        return res.status(400).json({ error: "Only image files are supported for AI classification" });
      }

      console.log(`AI classifying document: ${req.file.originalname} (${req.file.mimetype})`);
      
      // Use Gemini AI to classify the document
      const classification = await classifyDocument(req.file.buffer, req.file.mimetype);
      
      res.json({
        success: true,
        classification: {
          documentType: classification.type,
          confidence: classification.confidence,
          language: classification.language,
          filename: req.file.originalname,
          fileType: req.file.mimetype
        }
      });
    } catch (error) {
      console.error('AI document classification error:', error);
      res.status(500).json({ error: "Failed to classify document with AI" });
    }
  });

  // AI Document Analysis API - Full document analysis using Gemini AI
  app.post("/api/ai/analyze-document", requireAuth, upload.single('document'), async (req: any, res: any) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No document uploaded" });
      }

      // Validate file type
      if (!req.file.mimetype.startsWith('image/')) {
        return res.status(400).json({ error: "Only image files are supported for AI analysis" });
      }

      console.log(`AI analyzing document: ${req.file.originalname} (${req.file.mimetype})`);
      
      // Use Gemini AI to perform full document analysis
      const analysis = await analyzeDocument(req.file.buffer, req.file.mimetype);
      
      res.json({
        success: true,
        analysis: {
          extractedText: analysis.extractedText,
          documentType: analysis.documentType,
          confidence: analysis.confidence,
          language: analysis.language,
          extractedFields: analysis.extractedFields,
          filename: req.file.originalname,
          fileType: req.file.mimetype,
          summary: await summarizeDocument(analysis.extractedText)
        }
      });
    } catch (error) {
      console.error('AI document analysis error:', error);
      res.status(500).json({ error: "Failed to analyze document with AI" });
    }
  });

  // OCR Analytics API - Returns detailed OCR processing statistics and extracted data insights
  app.get("/api/analytics/ocr", requireAuth, async (req: any, res: any) => {
    try {
      const allDocuments = await storage.getAllDocuments();
      
      // Basic OCR statistics
      const totalDocuments = allDocuments.length;
      const completedDocuments = allDocuments.filter(doc => doc.ocrStatus === 'completed');
      const failedDocuments = allDocuments.filter(doc => doc.ocrStatus === 'failed');
      const processingDocuments = allDocuments.filter(doc => doc.ocrStatus === 'processing');
      
      // Processing accuracy and confidence metrics
      const successRate = totalDocuments > 0 ? (completedDocuments.length / totalDocuments) * 100 : 0;
      const avgConfidence = completedDocuments.length > 0 
        ? completedDocuments.reduce((sum, doc) => sum + (doc.confidence || 0), 0) / completedDocuments.length 
        : 0;

      // Document type distribution from extracted data
      const documentTypes = new Map<string, number>();
      const extractedClaimsData: any[] = [];
      let totalExtractedArea = 0;
      let extractedClaimsCount = 0;

      completedDocuments.forEach(doc => {
        if (doc.extractedData && typeof doc.extractedData === 'object') {
          const data = doc.extractedData as any;
          
          // Document type analysis
          const docType = data.documentType || 'Unknown';
          documentTypes.set(docType, (documentTypes.get(docType) || 0) + 1);
          
          // Extract claims data if available
          if (data.extractedFields) {
            const fields = data.extractedFields;
            if (fields.claimNumber || fields.applicantName) {
              extractedClaimsCount++;
              
              // Calculate total area from extracted data
              if (fields.area && typeof fields.area === 'number') {
                totalExtractedArea += fields.area;
              }
              
              // Collect structured claims data for analytics
              extractedClaimsData.push({
                claimId: fields.claimNumber || 'Unknown',
                claimantName: fields.applicantName || 'Unknown',
                state: fields.state || 'Unknown',
                district: fields.district || 'Unknown',
                village: fields.village || 'Unknown',
                area: fields.area || 0,
                landType: fields.landType || 'Unknown',
                documentType: docType,
                confidence: doc.confidence || 0,
                extractedAt: doc.updatedAt
              });
            }
          }
        }
      });

      // State-wise extracted claims distribution
      const stateDistribution = new Map<string, number>();
      extractedClaimsData.forEach(claim => {
        stateDistribution.set(claim.state, (stateDistribution.get(claim.state) || 0) + 1);
      });

      // Land type distribution
      const landTypeDistribution = new Map<string, number>();
      extractedClaimsData.forEach(claim => {
        landTypeDistribution.set(claim.landType, (landTypeDistribution.get(claim.landType) || 0) + 1);
      });

      // Monthly processing trends (last 6 months)
      const monthlyProcessing = new Map<string, { processed: number; failed: number }>();
      const now = new Date();
      
      allDocuments.forEach(doc => {
        const dateValue = doc.updatedAt || doc.createdAt;
        if (!dateValue) return;
        const docDate = new Date(dateValue);
        const monthKey = docDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        
        if (!monthlyProcessing.has(monthKey)) {
          monthlyProcessing.set(monthKey, { processed: 0, failed: 0 });
        }
        
        const monthData = monthlyProcessing.get(monthKey)!;
        if (doc.ocrStatus === 'completed') {
          monthData.processed++;
        } else if (doc.ocrStatus === 'failed') {
          monthData.failed++;
        }
      });

      const response = {
        summary: {
          totalDocuments,
          processedDocuments: completedDocuments.length,
          failedDocuments: failedDocuments.length,
          processingDocuments: processingDocuments.length,
          successRate: Math.round(successRate * 100) / 100,
          averageConfidence: Math.round(avgConfidence * 100) / 100,
          extractedClaimsCount,
          totalExtractedArea: Math.round(totalExtractedArea * 100) / 100
        },
        documentTypes: Array.from(documentTypes.entries()).map(([type, count]) => ({
          type,
          count,
          percentage: Math.round((count / completedDocuments.length) * 100)
        })),
        stateDistribution: Array.from(stateDistribution.entries()).map(([state, count]) => ({
          state,
          count,
          percentage: Math.round((count / extractedClaimsCount) * 100)
        })),
        landTypeDistribution: Array.from(landTypeDistribution.entries()).map(([landType, count]) => ({
          landType,
          count,
          percentage: Math.round((count / extractedClaimsCount) * 100)
        })),
        monthlyTrends: Array.from(monthlyProcessing.entries())
          .map(([month, data]) => ({ month, ...data }))
          .sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime())
          .slice(-6)
      };

      res.json(response);
    } catch (error) {
      console.error('OCR analytics error:', error);
      res.status(500).json({ error: "Failed to fetch OCR analytics" });
    }
  });

  // UNIFIED Claims API - Returns aggregated statistics by state/district/year/month
  app.get("/api/claims", requireAuth, async (req, res) => {
    try {
      const { state, district, year, month, format, status, officer } = req.query;
      
      // Parse query parameters safely
      const qYear = req.query.year ? Number(req.query.year) : undefined;
      const qMonth = req.query.month ? Number(req.query.month) : undefined;
      
      // If format=detailed, return individual claims (legacy support with all filters)
      if (format === 'detailed') {
        let claims = await storage.getAllClaims();
        
        // Apply all legacy filters
        if (state) {
          claims = await storage.getClaimsByState(state as string);
        } else if (district) {
          claims = await storage.getClaimsByDistrict(district as string);
        } else if (status) {
          claims = await storage.getClaimsByStatus(status as string);
        } else if (officer) {
          claims = await storage.getClaimsByOfficer(officer as string);
        }
        
        return res.json(claims);
      }
      
      // Default: Return unified aggregated data
      const allClaims = await storage.getAllClaims();
      const aggregatedData: any[] = [];
      
      // Group claims by state, district, year, month
      const groupedClaims = groupClaimsByLocation(allClaims);
      
      // Convert Map to Array to avoid iterator issues
      for (const [locationKey, claims] of Array.from(groupedClaims.entries())) {
        const [stateName, districtName, yearMonth] = locationKey.split('|');
        const [grpYear, grpMonth] = yearMonth.split('-').map(Number);
        
        // Filter by query parameters (fixed variable shadowing)
        if (state && stateName !== state) continue;
        if (district && districtName !== district) continue;
        if (qYear && grpYear !== qYear) continue;
        if (qMonth && grpMonth !== qMonth) continue;
        
        // Categorize claims by land type and status
        const ifrClaims = claims.filter((c: any) => c.landType === 'individual');
        const cfrClaims = claims.filter((c: any) => c.landType === 'community');
        
        const ifrReceived = ifrClaims.length;
        const cfrReceived = cfrClaims.length;
        const ifrTitles = ifrClaims.filter((c: any) => c.status === 'approved').length;
        const cfrTitles = cfrClaims.filter((c: any) => c.status === 'approved').length;
        const ifrRejected = ifrClaims.filter((c: any) => c.status === 'rejected').length;
        const cfrRejected = cfrClaims.filter((c: any) => c.status === 'rejected').length;
        
        // Calculate average processing time (only for claims with valid dates)
        const processedClaims = claims.filter((c: any) => {
          const hasProcessed = c.dateProcessed;
          const hasSubmitted = c.dateSubmitted || c.createdAt;
          return hasProcessed && hasSubmitted;
        });
        
        const processingTimes = processedClaims.map((c: any) => {
          const submitted = new Date(c.dateSubmitted || c.createdAt);
          const processed = new Date(c.dateProcessed);
          
          // Validate both dates to prevent NaN
          if (isNaN(submitted.getTime()) || isNaN(processed.getTime())) {
            return 0; // Safe fallback
          }
          
          return Math.round((processed.getTime() - submitted.getTime()) / (1000 * 60 * 60 * 24));
        }).filter((days: number) => days >= 0); // Filter out negative/invalid times
        
        const avgProcessingTime = processingTimes.length > 0 
          ? Math.round(processingTimes.reduce((a: number, b: number) => a + b, 0) / processingTimes.length)
          : 0;
        
        aggregatedData.push({
          state: stateName,
          district: districtName,
          year: grpYear,
          month: grpMonth,
          ifr_received: ifrReceived,
          cfr_received: cfrReceived,
          ifr_titles: ifrTitles,
          cfr_titles: cfrTitles,
          ifr_rejected: ifrRejected,
          cfr_rejected: cfrRejected,
          processing_time_days: avgProcessingTime,
          total_claims: claims.length
        });
      }
      
      res.json(aggregatedData);
    } catch (error) {
      console.error('Unified claims API error:', error);
      res.status(500).json({ error: "Failed to fetch claims data" });
    }
  });
  
  // Helper function to group claims by location and time with safe date handling
  function groupClaimsByLocation(claims: any[]): Map<string, any[]> {
    const grouped = new Map<string, any[]>();
    
    for (const claim of claims) {
      // Safely handle date with fallbacks
      const dateField = claim.dateSubmitted || claim.createdAt;
      if (!dateField) {
        console.warn(`Skipping claim ${claim.id}: no valid date field`);
        continue;
      }
      
      const date = new Date(dateField);
      if (isNaN(date.getTime())) {
        console.warn(`Skipping claim ${claim.id}: invalid date ${dateField}`);
        continue;
      }
      
      const year = date.getFullYear();
      const month = date.getMonth() + 1; // 1-based month
      const locationKey = `${claim.state || 'Unknown'}|${claim.district || 'Unknown'}|${year}-${month}`;
      
      if (!grouped.has(locationKey)) {
        grouped.set(locationKey, []);
      }
      grouped.get(locationKey)!.push(claim);
    }
    
    return grouped;
  }

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

  app.post("/api/claims", requireAuth, requireRole("ministry", "state", "district"), async (req: any, res) => {
    try {
      const claimData = insertClaimSchema.parse(req.body);
      const claim = await storage.createClaim(claimData);
      
      // Broadcast real-time event for new claim creation
      (req.app as any).broadcastEvent({
        type: 'claim_created',
        data: { 
          claim,
          createdBy: {
            id: req.user.id,
            username: req.user.username,
            role: req.user.role
          }
        },
        targetRoles: ['ministry', 'state', 'district', 'village'],
        targetStates: claim.state ? [claim.state] : undefined,
        targetDistricts: claim.district ? [claim.district] : undefined,
        excludeUsers: [] // Send to all relevant users
      });
      
      console.log(`New claim created: ${claim.id} by ${req.user.username}`);
      res.status(201).json(claim);
    } catch (error) {
      res.status(400).json({ error: "Invalid claim data" });
    }
  });

  app.patch("/api/claims/:id", requireAuth, requireRole("ministry", "state", "district"), async (req: any, res) => {
    try {
      const updates = req.body;
      const claim = await storage.updateClaim(req.params.id, updates);
      if (!claim) {
        return res.status(404).json({ error: "Claim not found" });
      }
      
      // Broadcast real-time event for claim update
      (req.app as any).broadcastEvent({
        type: 'claim_updated',
        data: { 
          claim,
          updates,
          updatedBy: {
            id: req.user.id,
            username: req.user.username,
            role: req.user.role
          }
        },
        targetRoles: ['ministry', 'state', 'district', 'village'],
        targetStates: claim.state ? [claim.state] : undefined,
        targetDistricts: claim.district ? [claim.district] : undefined,
        excludeUsers: [] // Send to all relevant users
      });
      
      console.log(`Claim updated: ${claim.id} by ${req.user.username}`);
      res.json(claim);
    } catch (error) {
      res.status(400).json({ error: "Failed to update claim" });
    }
  });

  app.post("/api/claims/:id/approve", requireAuth, requireRole("ministry", "state", "district"), async (req: any, res: any) => {
    try {
      // Use already validated session and user from requireAuth middleware
      const claim = await storage.updateClaim(req.params.id, {
        status: "approved",
        dateProcessed: new Date(),
        assignedOfficer: req.user.id
      });

      if (!claim) {
        return res.status(404).json({ error: "Claim not found" });
      }

      // Broadcast real-time event for claim approval
      (req.app as any).broadcastEvent({
        type: 'claim_approved',
        data: { 
          claim,
          approvedBy: {
            id: req.user.id,
            username: req.user.username,
            role: req.user.role
          }
        },
        targetRoles: ['ministry', 'state', 'district', 'village'],
        targetStates: claim.state ? [claim.state] : undefined,
        targetDistricts: claim.district ? [claim.district] : undefined
      });

      // Log the approval
      await storage.logAudit({
        userId: req.user.id,
        action: "approve_claim",
        resourceType: "claim",
        resourceId: req.params.id,
        changes: { status: "approved" },
        ipAddress: req.ip || null,
        userAgent: req.get('User-Agent') || null
      });

      console.log(`Claim approved: ${claim.id} by ${req.user.username}`);
      res.json(claim);
    } catch (error) {
      res.status(500).json({ error: "Failed to approve claim" });
    }
  });

  app.post("/api/claims/:id/reject", requireAuth, requireRole("ministry", "state", "district"), async (req: any, res: any) => {
    try {
      // Use already validated session and user from requireAuth middleware
      const { reason } = req.body;
      const existingClaim = await storage.getClaim(req.params.id);
      const claim = await storage.updateClaim(req.params.id, {
        status: "rejected",
        dateProcessed: new Date(),
        assignedOfficer: req.user.id,
        notes: reason || existingClaim?.notes
      });

      if (!claim) {
        return res.status(404).json({ error: "Claim not found" });
      }

      // Broadcast real-time event for claim rejection
      (req.app as any).broadcastEvent({
        type: 'claim_rejected',
        data: { 
          claim,
          reason,
          rejectedBy: {
            id: req.user.id,
            username: req.user.username,
            role: req.user.role
          }
        },
        targetRoles: ['ministry', 'state', 'district', 'village'],
        targetStates: claim.state ? [claim.state] : undefined,
        targetDistricts: claim.district ? [claim.district] : undefined
      });

      // Log the rejection
      await storage.logAudit({
        userId: req.user.id,
        action: "reject_claim",
        resourceType: "claim",
        resourceId: req.params.id,
        changes: { status: "rejected", reason },
        ipAddress: req.ip || null,
        userAgent: req.get('User-Agent') || null
      });

      console.log(`Claim rejected: ${claim.id} by ${req.user.username}`);
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
      
      // Broadcast real-time event for OCR processing start
      (app as any).broadcastEvent({
        type: 'document_ocr_started',
        data: { 
          documentId,
          status: 'processing'
        },
        targetRoles: ['ministry', 'state', 'district', 'village']
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

      // AI-powered OCR and data extraction
      const ocrText = await extractTextFromDocument(document, fileBuffer);
      const extractedData = await extractStructuredDataWithAI(document, fileBuffer, ocrText);
      const confidence = extractedData.confidence || calculateConfidence(ocrText, document);

      // File content is stored permanently in database, no cleanup needed

      // Update document with OCR results
      await storage.updateDocument(documentId, {
        ocrStatus: 'completed',
        ocrText: ocrText,
        extractedData: extractedData,
        confidence: confidence
      });

      // Broadcast real-time event for OCR completion
      (app as any).broadcastEvent({
        type: 'document_ocr_completed',
        data: { 
          documentId,
          status: 'completed',
          extractedData,
          confidence
        },
        targetRoles: ['ministry', 'state', 'district', 'village']
      });

      console.log(`Real OCR processing completed for document ${documentId}`);
    } catch (error) {
      console.error(`OCR processing failed for document ${documentId}:`, error);
      
      // Determine error type for better user feedback
      let errorMessage = 'OCR processing failed';
      if (error instanceof Error) {
        if (error.message.includes('Document not found')) {
          errorMessage = 'Document not found';
        } else if (error.message.includes('File content not found')) {
          errorMessage = 'File content missing from database';
        } else if (error.message.includes('Unsupported file type')) {
          errorMessage = 'File type not supported for OCR';
        } else if (error.message.includes('No text')) {
          errorMessage = 'No readable text found in document';
        } else {
          errorMessage = error.message;
        }
      }
      
      // File content remains in database for potential retry
      await storage.updateDocument(documentId, {
        ocrStatus: 'failed'
      });
      
      // Broadcast real-time event for OCR failure with improved error message
      (app as any).broadcastEvent({
        type: 'document_ocr_failed',
        data: { 
          documentId,
          status: 'failed',
          error: errorMessage
        },
        targetRoles: ['ministry', 'state', 'district', 'village']
      });
    }
  }

  // Extract text from document using AI-powered OCR
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
        // AI-powered text extraction with Gemini
        console.log('Processing image with AI-powered OCR...');
        try {
          const aiResult = await extractText(fileBuffer, fileType);
          return aiResult.text;
        } catch (aiError) {
          console.log('AI OCR failed, falling back to Tesseract:', aiError);
          return await extractTextFromImageBuffer(fileBuffer, document.originalFilename);
        }
      } else {
        return `Unsupported file type: ${fileType}. Please upload PDF, JPEG, PNG, or TIFF files.`;
      }
    } catch (error: any) {
      console.error('Text extraction error:', error);
      return `Error extracting text from document: ${error?.message || error}`;
    }
  }

  // Extract text from image using enhanced Tesseract OCR with multi-language support
  async function extractTextFromImageBuffer(imageBuffer: Buffer, filename: string): Promise<string> {
    let worker = null;
    try {
      console.log(`Starting enhanced multi-language OCR for image: ${filename}`);
      
      // Create Tesseract worker with comprehensive Indian language support
      // Supports all major languages used in FRA documentation
      const languages = ['eng', 'hin', 'ori', 'tel', 'ben', 'guj'];
      worker = await createWorker(languages);
      
      // Configure OCR for government document processing
      await worker.setParameters({
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,()-/:; ' +
                                 'अआइईउऊएऐओऔकखगघङचछजझञटठडढणतथदधनपफबभमयरलवशषसह' + // Hindi
                                 'ଅଆଇଈଉଊଏଐଓଔକଖଗଘଙଚଛଜଝଞଟଠଡଢଣତଥଦଧନପଫବଭମଯରଲଵଶଷସହ' + // Odia
                                 'అआইईউేైొౌకఃగఘఙచఛజఝఞటఠడఢణతథదధనపఫబభమయరలవశషసహ' + // Telugu
                                 'অআইঈউঊএঐওঔকখগঘঙচছজঝঞটঠডঢণতথদধনপফবভমযরলশষসহ' + // Bengali
                                 'અઆઇઈઉઊએઐઓઔકખગઘઙચછજઝઞટઠડઢણતથદધનપફબભમયરલવશષસહ', // Gujarati
        tessedit_pageseg_mode: PSM.SINGLE_BLOCK, // Uniform block of text
        preserve_interword_spaces: '1',
        user_defined_dpi: '300'
      });
      
      // Perform OCR on the image buffer
      const { data: { text, confidence } } = await worker.recognize(imageBuffer);
      
      console.log(`Enhanced OCR completed with confidence: ${confidence}%`);
      console.log(`Extracted text length: ${text.length} characters`);
      console.log(`Languages detected: ${languages.join(', ')}`);
      
      if (text && text.trim().length > 0) {
        return text.trim();
      } else {
        return `No text could be extracted from the image. The image may be too blurry, have poor contrast, or contain no readable text. Supported languages: English, Hindi, Odia, Telugu, Bengali, Gujarati.`;
      }
    } catch (error: any) {
      console.error('Enhanced OCR error:', error);
      return `OCR processing failed: ${error?.message || error}. Please ensure the image is clear and contains readable text in one of the supported languages (English, Hindi, Odia, Telugu, Bengali, Gujarati).`;
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

  // AI-powered structured data extraction with enhanced accuracy
  async function extractStructuredDataWithAI(document: any, fileBuffer: Buffer, fallbackText: string): Promise<any> {
    try {
      // First try AI-powered analysis for structured data extraction
      if (document.fileType.startsWith('image/')) {
        console.log('Using AI-powered document analysis...');
        const aiResult = await analyzeDocument(fileBuffer, document.fileType);
        
        return {
          documentType: aiResult.documentType,
          processingDate: new Date().toISOString().split('T')[0],
          confidence: aiResult.confidence,
          language: aiResult.language,
          validationStatus: 'ai_processed',
          fileInfo: {
            originalName: document.originalFilename,
            fileType: document.fileType,
            fileSize: document.fileSize
          },
          extractedFields: aiResult.extractedFields,
          extractedText: aiResult.extractedText
        };
      }
    } catch (aiError) {
      console.log('AI analysis failed, falling back to pattern matching:', aiError);
    }
    
    // Fallback to pattern-based extraction
    return await extractStructuredData(fallbackText, document);
  }

  // Enhanced structured data extraction with government compliance rules
  async function extractStructuredData(ocrText: string, document: any): Promise<any> {
    const extractedData: any = {
      documentType: 'Unknown',
      processingDate: new Date().toISOString().split('T')[0],
      confidence: 'Unknown',
      validationStatus: 'pending',
      fileInfo: {
        originalName: document.originalFilename,
        fileType: document.fileType,
        fileSize: document.fileSize
      },
      extractedFields: {}
    };

    const text = ocrText.toLowerCase();
    const lines = ocrText.split('\n').filter(line => line.trim().length > 0);
    
    // Enhanced FRA document detection with multilingual support
    const fraKeywords = [
      'forest rights', 'fra', 'वन अधिकार', 'ବନ ଅଧିକାର', 'అరణ్య హక్కులు', 
      'বন অধিকার', 'વન અધિકાર', 'forest right act', 'scheduled tribes'
    ];
    
    const isFRADocument = fraKeywords.some(keyword => text.includes(keyword));
    
    if (isFRADocument) {
      extractedData.documentType = 'FRA Claim Form';
      extractedData.confidence = 'High';
      
      // Enhanced field extraction with government patterns
      await extractFRAFields(lines, extractedData);
      
      // Validate extracted FRA data
      extractedData.validationStatus = validateFRAData(extractedData.extractedFields);
      
    } else if (isIdentityDocument(text)) {
      extractedData.documentType = 'Identity Document';
      extractedData.confidence = 'Medium';
      await extractIdentityFields(lines, extractedData);
      
    } else if (isSurveyDocument(text)) {
      extractedData.documentType = 'Survey/Settlement Record';
      extractedData.confidence = 'Medium';
      await extractSurveyFields(lines, extractedData);
      
    } else {
      extractedData.confidence = 'Low';
      extractedData.validationStatus = 'manual_review_required';
    }

    return extractedData;
  }

  // Extract FRA-specific fields with government compliance patterns
  async function extractFRAFields(lines: string[], extractedData: any): Promise<void> {
    const fields = extractedData.extractedFields;
    
    for (const line of lines) {
      const lowerLine = line.toLowerCase();
      
      // Enhanced claim number patterns (FRA-STATE-YEAR-NUMBER format)
      const claimPattern = /(?:claim|application|आवेदन)[\s\w]*?[\:\-\s]*([a-z]{2,3}[-\/]\d{4}[-\/]\d{4,6}|fra[-\/][a-z]{2}[-\/]\d{4}[-\/]\d{4,6})/i;
      const claimMatch = line.match(claimPattern);
      if (claimMatch) {
        fields.claimNumber = claimMatch[1].toUpperCase();
      }
      
      // Enhanced name extraction with multilingual support
      const namePatterns = [
        /(?:name|नाम|ନାମ|పేరు|নাম|નામ)[\s\:]*([a-zA-Z\u0900-\u097F\u0B00-\u0B7F\u0C00-\u0C7F\u0980-\u09FF\u0A80-\u0AFF\s]{2,50})/i,
        /(?:applicant|आवेदक|ଆବେଦନକାରୀ|దరఖాస్తుదారు|আবেদনকারী|અરજદાર)[\s\:]*([a-zA-Z\u0900-\u097F\u0B00-\u0B7F\u0C00-\u0C7F\u0980-\u09FF\u0A80-\u0AFF\s]{2,50})/i
      ];
      for (const pattern of namePatterns) {
        const nameMatch = line.match(pattern);
        if (nameMatch && !fields.applicantName) {
          fields.applicantName = nameMatch[1].trim();
          break;
        }
      }
      
      // Enhanced location extraction
      const locationPatterns = [
        /(?:village|gram|गाँव|ଗାଁ|గ్రామం|গ্রাম|ગામ)[\s\:]*([a-zA-Z\u0900-\u097F\u0B00-\u0B7F\u0C00-\u0C7F\u0980-\u09FF\u0A80-\u0AFF\s]{2,30})/i,
        /(?:district|जिला|ଜିଲ୍ଲା|జిల్లా|জেলা|જિલ્લો)[\s\:]*([a-zA-Z\u0900-\u097F\u0B00-\u0B7F\u0C00-\u0C7F\u0980-\u09FF\u0A80-\u0AFF\s]{2,30})/i,
        /(?:state|राज्य|ରାଜ୍ୟ|రాష్ట్రం|রাজ্য|રાજ્ય)[\s\:]*([a-zA-Z\u0900-\u097F\u0B00-\u0B7F\u0C00-\u0C7F\u0980-\u09FF\u0A80-\u0AFF\s]{2,30})/i
      ];
      locationPatterns.forEach((pattern, index) => {
        const match = line.match(pattern);
        if (match) {
          const fieldNames = ['village', 'district', 'state'];
          if (!fields[fieldNames[index]]) {
            fields[fieldNames[index]] = match[1].trim();
          }
        }
      });
      
      // Enhanced area measurement with multiple units
      const areaPattern = /(\d+\.?\d*)\s*(hectare|acre|ha|हेक्टेयर|एकड़|ହେକ୍ଟର|హెక్టార్|হেক্টর|હેક્ટર)/i;
      const areaMatch = line.match(areaPattern);
      if (areaMatch && !fields.area) {
        fields.area = parseFloat(areaMatch[1]);
        fields.areaUnit = areaMatch[2];
      }
      
      // Land type detection
      if ((lowerLine.includes('individual') || lowerLine.includes('व्यक्तिगत') || lowerLine.includes('ବ୍ୟକ୍ତିଗତ')) && !fields.landType) {
        fields.landType = 'individual';
      } else if ((lowerLine.includes('community') || lowerLine.includes('सामुदायिक') || lowerLine.includes('ସାମୁଦାୟିକ')) && !fields.landType) {
        fields.landType = 'community';
      }
    }
  }
  
  // Validation functions for government compliance
  function validateFRAData(fields: any): string {
    const errors = [];
    
    if (!fields.claimNumber) errors.push('Missing claim number');
    if (!fields.applicantName || fields.applicantName.length < 2) errors.push('Invalid applicant name');
    if (!fields.village) errors.push('Missing village information');
    if (!fields.district) errors.push('Missing district information');
    if (!fields.state) errors.push('Missing state information');
    if (!fields.area || fields.area <= 0) errors.push('Invalid area measurement');
    if (!fields.landType) errors.push('Missing land type (individual/community)');
    
    if (errors.length === 0) return 'validated';
    if (errors.length <= 2) return 'partial_validation';
    return 'validation_failed';
  }
  
  function isIdentityDocument(text: string): boolean {
    const identityKeywords = ['aadhaar', 'आधार', 'identity', 'पहचान', 'voter', 'मतदाता', 'driving', 'passport'];
    return identityKeywords.some(keyword => text.includes(keyword));
  }
  
  function isSurveyDocument(text: string): boolean {
    const surveyKeywords = ['survey', 'settlement', 'revenue', 'सर्वेक्षण', 'बंदोबस्त', 'राजस्व', 'khata', 'खाता'];
    return surveyKeywords.some(keyword => text.includes(keyword));
  }
  
  async function extractIdentityFields(lines: string[], extractedData: any): Promise<void> {
    // Basic identity document field extraction
    const fields = extractedData.extractedFields;
    fields.documentSubtype = 'identity_verification';
  }
  
  async function extractSurveyFields(lines: string[], extractedData: any): Promise<void> {
    // Basic survey document field extraction  
    const fields = extractedData.extractedFields;
    fields.documentSubtype = 'land_survey';
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
        return res.status(415).json({ error: "Unsupported file type. Please upload PDF, JPG, PNG, or TIFF files." });
      }

      // Validate file size (already handled by multer, but let's provide better error message)
      if (file.size > 50 * 1024 * 1024) {
        return res.status(413).json({ error: "File too large. Maximum file size is 50MB." });
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
      
      // Handle specific error types
      if (error instanceof Error) {
        if (error.message.includes('LIMIT_FILE_SIZE')) {
          return res.status(413).json({ error: "File too large. Maximum file size is 50MB." });
        }
        if (error.message.includes('LIMIT_UNEXPECTED_FILE')) {
          return res.status(400).json({ error: "Invalid file field. Please use 'document' field name." });
        }
      }
      
      res.status(500).json({ error: "Failed to upload document. Please try again." });
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

  // Create claim from OCR document data
  app.post("/api/documents/:id/create-claim", requireAuth, requireRole("ministry", "state", "district"), async (req, res) => {
    try {
      const document = await storage.getDocument(req.params.id);
      if (!document) {
        return res.status(404).json({ error: "Document not found" });
      }

      if (!document.extractedData) {
        return res.status(400).json({ error: "No extracted data available for claim creation" });
      }

      const extractedFields = (document.extractedData as any)?.extractedFields || {};
      
      // Generate unique claim ID
      const stateCode = extractedFields.state?.substring(0, 2)?.toUpperCase() || 'XX';
      const claimId = `FRA-${stateCode}-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
      
      // Map extracted data to claim format
      const claimData = {
        claimId,
        claimantName: extractedFields.applicantName || 'Unknown Claimant',
        location: `${extractedFields.village || ''}, ${extractedFields.district || ''}`.trim().replace(/^,\s*/, ''),
        village: extractedFields.village || 'Unknown Village',
        tehsil: extractedFields.tehsil || extractedFields.village || 'Unknown Tehsil',
        district: extractedFields.district || 'Unknown District',
        state: extractedFields.state || 'Unknown State',
        area: extractedFields.area || 0,
        landType: extractedFields.landType || 'individual',
        status: 'pending',
        dateSubmitted: extractedFields.submissionDate ? new Date(extractedFields.submissionDate) : new Date(),
        assignedOfficer: (req as any).user.id,
        notes: `Auto-created from document ${document.originalFilename} via AI extraction`,
        familyMembers: extractedFields.familyMembers,
        surveyNumber: extractedFields.surveyNumber,
        forestType: extractedFields.forestType,
        tribalCommunity: extractedFields.tribalCommunity
      };

      // Create the claim
      const newClaim = await storage.createClaim(claimData);
      
      // Update document status to indicate claim created
      await storage.updateDocument(req.params.id, {
        reviewStatus: 'approved-claim-created'
      });

      console.log(`Claim created from document ${document.id}: ${newClaim.claimId}`);
      res.json({ 
        claim: newClaim, 
        message: 'Claim created successfully from extracted document data' 
      });
    } catch (error) {
      console.error('Error creating claim from document:', error);
      res.status(500).json({ error: "Failed to create claim from document" });
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
      
      const workflow = await storage.createWorkflow(workflowData);
      
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
      
      // Broadcast real-time event for new workflow creation
      (req.app as any).broadcastEvent({
        type: 'workflow_created',
        data: { 
          workflow,
          createdBy: {
            id: user.id,
            username: user.username,
            role: user.role
          }
        },
        targetRoles: ['ministry', 'state', 'district', 'village'],
        targetUsers: [user.id] // Send to creator
      });
      
      console.log(`New workflow created: ${workflow.id} by ${user.username}`);
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
      const workflow = await storage.getWorkflow(req.params.id);
      if (!workflow) {
        return res.status(404).json({ error: "Workflow not found" });
      }
      
      const steps = await storage.getWorkflowSteps(req.params.id);
      const transitions: any[] = []; // No workflow transitions implementation yet
      
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
      
      const workflow = await storage.updateWorkflow(req.params.id, updates);
      if (!workflow) {
        return res.status(404).json({ error: "Workflow not found" });
      }
      
      // Broadcast real-time event for workflow update
      (req.app as any).broadcastEvent({
        type: 'workflow_updated',
        data: { 
          workflow,
          updates,
          updatedBy: {
            id: user.id,
            username: user.username,
            role: user.role
          }
        },
        targetRoles: ['ministry', 'state', 'district', 'village'],
        targetUsers: [workflow.userId] // Send to workflow owner
      });
      
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
      
      console.log(`Workflow updated: ${workflow.id} by ${user.username}`);
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
      
      await storage.updateWorkflow(req.params.workflowId, {
        completedSteps,
        currentStep: currentStep || 'completed',
        lastActiveAt: new Date()
      });
      
      // Broadcast real-time event for workflow step update
      (req.app as any).broadcastEvent({
        type: 'workflow_step_updated',
        data: { 
          step,
          workflowId: req.params.workflowId,
          updates,
          completedSteps,
          currentStep: currentStep || 'completed',
          updatedBy: {
            id: user.id,
            username: user.username,
            role: user.role
          }
        },
        targetRoles: ['ministry', 'state', 'district', 'village']
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
      
      console.log(`Workflow step updated: ${step.id} in workflow ${req.params.workflowId} by ${user.username}`);
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
      
      // Broadcast real-time event for workflow transition
      (req.app as any).broadcastEvent({
        type: 'workflow_transition_created',
        data: { 
          transition,
          workflowId: req.params.workflowId,
          triggeredBy: {
            id: user.id,
            username: user.username,
            role: user.role
          }
        },
        targetRoles: ['ministry', 'state', 'district', 'village']
      });
      
      console.log(`Workflow transition created: ${transition.id} for workflow ${req.params.workflowId} by ${user.username}`);
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
      const workflow = await storage.updateWorkflow(req.params.id, {
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
      
      // Broadcast real-time event for workflow continuation
      (req.app as any).broadcastEvent({
        type: 'workflow_continued',
        data: { 
          workflow,
          fromStep,
          continuedBy: {
            id: user.id,
            username: user.username,
            role: user.role
          }
        },
        targetRoles: ['ministry', 'state', 'district', 'village'],
        targetUsers: [workflow.userId] // Send to workflow owner
      });
      
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
      
      console.log(`Workflow continued: ${workflow.id} from step ${fromStep} by ${user.username}`);
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
          // w.completedAt is guaranteed to exist due to filter above
          const completedTime = new Date(w.completedAt!).getTime();
          // Skip entries without startedAt or with invalid dates
          if (!w.startedAt) return sum;
          const startTime = new Date(w.startedAt).getTime();
          if (isNaN(startTime) || isNaN(completedTime)) return sum;
          // Ensure non-negative duration
          const duration = Math.max(0, completedTime - startTime);
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

  // Real Data Import Routes
  const dataImportService = new DataImportService(storage);
  const govApiService = new GovernmentAPIService(storage, {
    dataGovInApiKey: process.env.DATA_GOV_IN_API_KEY
  });

  // Import real FRA claims from CSV
  app.post("/api/admin/import-claims", requireAuth, requireRole('ministry', 'state'), async (req: any, res: any) => {
    try {
      console.log('Starting CSV claims import...');
      const csvPath = 'sample-fra-claims.csv';
      const importedCount = await dataImportService.importClaimsFromCSV(csvPath);
      
      res.json({ 
        success: true, 
        message: `Successfully imported ${importedCount} real FRA claims from government data`,
        imported_count: importedCount
      });
    } catch (error) {
      console.error('Claims import error:', error);
      res.status(500).json({ 
        success: false, 
        error: "Failed to import claims data",
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Import comprehensive geographical data
  app.post("/api/admin/import-geography", requireAuth, requireRole('ministry'), async (req: any, res: any) => {
    try {
      console.log('Starting comprehensive geographical data import...');
      await dataImportService.importComprehensiveGeographicalData();
      
      res.json({ 
        success: true, 
        message: "Successfully imported comprehensive states and districts data from government sources"
      });
    } catch (error) {
      console.error('Geography import error:', error);
      res.status(500).json({ 
        success: false, 
        error: "Failed to import geographical data",
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get forest cover data from government APIs
  app.get("/api/gov-data/forest-cover/:stateCode?", requireAuth, async (req: any, res: any) => {
    try {
      const { stateCode } = req.params;
      const forestData = await govApiService.fetchForestCoverData(stateCode);
      
      res.json({
        success: true,
        data: forestData,
        source: "Forest Survey of India via data.gov.in API"
      });
    } catch (error) {
      console.error('Forest data API error:', error);
      res.status(500).json({ 
        success: false, 
        error: "Failed to fetch forest cover data"
      });
    }
  });

  // Get tribal demographic data
  app.get("/api/gov-data/tribal-demographics", requireAuth, async (req: any, res: any) => {
    try {
      const tribalData = await govApiService.fetchTribalDemographicData();
      
      res.json({
        success: true,
        data: tribalData,
        source: "Ministry of Tribal Affairs"
      });
    } catch (error) {
      console.error('Tribal data API error:', error);
      res.status(500).json({ 
        success: false, 
        error: "Failed to fetch tribal demographic data"
      });
    }
  });

  // Get FRA implementation statistics
  app.get("/api/gov-data/fra-stats", requireAuth, async (req: any, res: any) => {
    try {
      const fraStats = await govApiService.fetchFRAImplementationStats();
      
      res.json({
        success: true,
        data: fraStats,
        source: "Ministry of Tribal Affairs - FRA Implementation Dashboard"
      });
    } catch (error) {
      console.error('FRA stats API error:', error);
      res.status(500).json({ 
        success: false, 
        error: "Failed to fetch FRA implementation statistics"
      });
    }
  });

  // Enhanced DSS analysis with real government data
  app.post("/api/dss/analyze-with-gov-data", requireAuth, async (req: any, res: any) => {
    try {
      // Validate request body with Zod
      const requestSchema = z.object({
        claimId: z.string().min(1, "Claim ID is required")
      });
      
      const { claimId } = requestSchema.parse(req.body);

      const claim = await storage.getClaim(claimId);
      if (!claim) {
        return res.status(404).json({ error: "Claim not found" });
      }

      // Perform enhanced analysis with real government data
      const analysis = await govApiService.analyzeClaimWithRealData({
        claimId: claim.claimId,
        state: claim.state,
        area: claim.area,
        landType: claim.landType,
        familyMembers: claim.familyMembers,
        notes: claim.notes,
        coordinates: claim.coordinates
      });
      
      res.json({
        success: true,
        analysis,
        message: "Analysis completed using real government data sources"
      });
    } catch (error) {
      console.error('DSS analysis error:', error);
      res.status(500).json({ 
        success: false, 
        error: "Failed to analyze claim with government data"
      });
    }
  });

  // Get real policy rules and precedent data
  app.get("/api/dss/policy-rules", requireAuth, async (req: any, res: any) => {
    try {
      const policyRules = await govApiService.getPolicyRulesData();
      
      res.json({
        success: true,
        data: policyRules,
        source: "Forest Rights Act 2006 - Official Policy Rules"
      });
    } catch (error) {
      console.error('Policy rules error:', error);
      res.status(500).json({ 
        success: false, 
        error: "Failed to fetch policy rules data"
      });
    }
  });

  // Data import route for real FRA claims from government sources
  app.post("/api/admin/import-real-data", requireAuth, requireRole('ministry', 'state'), async (req: any, res: any) => {
    try {
      console.log('Starting import of real FRA data from government sources...');
      const { RealFRAImportService } = await import('./real-fra-import');
      const realImportService = new RealFRAImportService(storage);
      
      // Download and import real FRA data from government sources
      const csvFilePath = await realImportService.downloadRealFRAData();
      const claimsImported = await realImportService.importRealFRAStatistics(csvFilePath);
      
      // Import comprehensive geographical data
      const dataImportService = new DataImportService(storage);
      await dataImportService.importComprehensiveGeographicalData();
      
      // Get quarterly sync information (scheduler runs at server startup)
      const syncInfo = realImportService.getQuarterlySyncInfo();
      
      console.log(`Successfully imported ${claimsImported} real FRA statistics from government data`);
      
      res.json({ 
        success: true, 
        message: `Successfully imported ${claimsImported} FRA state statistics from Ministry of Tribal Affairs`,
        statisticsImported: claimsImported,
        source: 'Ministry of Tribal Affairs - Parliament Questions (Session 265)',
        next_sync: syncInfo.nextSync,
        sync_message: syncInfo.message
      });
    } catch (error) {
      console.error('Real data import error:', error);
      res.status(500).json({ 
        error: "Failed to import real government FRA data", 
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Test government API integration
  app.get("/api/admin/test-govt-api", requireAuth, requireRole('ministry', 'state'), async (req: any, res: any) => {
    try {
      const govtAPI = new GovernmentAPIService(storage, {
        dataGovInApiKey: process.env.DATA_GOV_API_KEY
      });
      
      console.log('Testing government API integration...');
      
      // Test different API endpoints
      const [forestData, tribalData, fraStats, policyRules] = await Promise.all([
        govtAPI.fetchForestCoverData('MP'),
        govtAPI.fetchTribalDemographicData(),
        govtAPI.fetchFRAImplementationStats(),
        govtAPI.getPolicyRulesData()
      ]);
      
      res.json({
        success: true,
        message: "Government API integration test completed",
        data: {
          forestCoverData: forestData,
          tribalDemographics: tribalData,
          fraImplementationStats: fraStats,
          policyRules: policyRules
        }
      });
    } catch (error) {
      console.error('Government API test error:', error);
      res.status(500).json({ 
        error: "Government API test failed", 
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  const httpServer = createServer(app);
  
  // WebSocket disabled to prevent connection issues
  // const wss = new WebSocketServer({ 
  //   server: httpServer,
  //   path: '/ws'
  // });

  // Store active WebSocket connections with user context and data scoping
  const activeConnections = new Map<string, { 
    ws: WebSocket; 
    userId: string; 
    role: string; 
    stateId: number | null;
    districtId: number | null;
  }>();

  // WebSocket Event Broadcasting System with Data Scoping
  const broadcastEvent = (event: {
    type: string;
    data: any;
    targetRoles?: string[];
    targetUsers?: string[];
    excludeUsers?: string[];
    targetStates?: string[];
    targetDistricts?: string[];
  }) => {
    console.log(`Broadcasting WebSocket event: ${event.type}`, { 
      targetRoles: event.targetRoles,
      targetUsers: event.targetUsers,
      connectionCount: activeConnections.size 
    });

    activeConnections.forEach((connection, connectionId) => {
      try {
        // Check if connection should receive this event with data scoping
        const shouldReceive = (
          (!event.targetRoles || event.targetRoles.includes(connection.role)) &&
          (!event.targetUsers || event.targetUsers.includes(connection.userId)) &&
          (!event.excludeUsers || !event.excludeUsers.includes(connection.userId)) &&
          (!event.targetStates || !connection.stateId || event.targetStates.includes(connection.stateId.toString())) &&
          (!event.targetDistricts || !connection.districtId || event.targetDistricts.includes(connection.districtId.toString()))
        );

        if (shouldReceive && connection.ws.readyState === WebSocket.OPEN) {
          connection.ws.send(JSON.stringify({
            type: event.type,
            data: event.data,
            timestamp: new Date().toISOString()
          }));
        }
      } catch (error) {
        console.error(`Failed to send WebSocket message to ${connectionId}:`, error);
        // Remove dead connections
        activeConnections.delete(connectionId);
      }
    });
  };

  // WebSocket Connection Handler (completely disabled)
  /*
  wss.on('connection', async (ws: WebSocket, req) => {
    console.log('New WebSocket connection attempt');
    
    try {
      // Extract session token from cookies only (more secure than query params)
      const token = req.headers.cookie?.match(/fra_session=([^;]+)/)?.[1];
      
      if (!token) {
        console.log('WebSocket connection rejected: No session cookie found');
        ws.close(1008, 'Authentication required');
        return;
      }

      // Validate session
      const session = await storage.getSession(token);
      if (!session) {
        console.log('WebSocket connection rejected: Invalid session');
        ws.close(1008, 'Invalid session');
        return;
      }

      const user = await storage.getUser(session.userId);
      if (!user || !user.isActive) {
        console.log('WebSocket connection rejected: User not found or inactive');
        ws.close(1008, 'User not found or inactive');
        return;
      }

      // Generate connection ID and store connection with data scoping context
      const connectionId = randomUUID();
      activeConnections.set(connectionId, { 
        ws, 
        userId: user.id, 
        role: user.role,
        stateId: user.stateId,
        districtId: user.districtId
      });

      console.log(`WebSocket authenticated for user ${user.username} (${user.role}). Active connections: ${activeConnections.size}`);

      // Send initial connection confirmation
      ws.send(JSON.stringify({
        type: 'connection_established',
        data: { 
          connectionId, 
          user: { 
            id: user.id, 
            username: user.username, 
            role: user.role 
          } 
        },
        timestamp: new Date().toISOString()
      }));

      // Handle incoming messages
      ws.on('message', async (message: Buffer) => {
        try {
          const data = JSON.parse(message.toString());
          console.log(`WebSocket message from ${user.username}:`, data.type);

          // Handle different message types
          switch (data.type) {
            case 'subscribe_to_workflow':
              // Subscribe to specific workflow updates
              ws.send(JSON.stringify({
                type: 'subscribed',
                data: { workflowId: data.workflowId },
                timestamp: new Date().toISOString()
              }));
              break;
              
            case 'ping':
              ws.send(JSON.stringify({
                type: 'pong',
                data: { timestamp: new Date().toISOString() },
                timestamp: new Date().toISOString()
              }));
              break;
              
            default:
              console.log(`Unknown WebSocket message type: ${data.type}`);
          }
        } catch (error) {
          console.error('Error processing WebSocket message:', error);
        }
      });

      // Handle connection close
      ws.on('close', () => {
        activeConnections.delete(connectionId);
        console.log(`WebSocket disconnected for user ${user.username}. Active connections: ${activeConnections.size}`);
      });

      // Handle connection errors
      ws.on('error', (error) => {
        console.error(`WebSocket error for user ${user.username}:`, error);
        activeConnections.delete(connectionId);
      });

    } catch (error) {
      console.error('WebSocket connection setup error:', error);
      ws.close(1011, 'Server error');
    }
  });
  */

  // Attach broadcast function to app for use in routes (disabled)
  (app as any).broadcastEvent = () => {};
  
  // console.log('WebSocket server initialized on /ws endpoint');
  
  return httpServer;
}
