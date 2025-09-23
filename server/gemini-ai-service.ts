import { GoogleGenAI } from "@google/genai";

// This API key is from Gemini Developer API Key, not vertex AI API Key
if (!process.env.GEMINI_API_KEY) {
  console.error("GEMINI_API_KEY environment variable is required");
  // Don't throw error during startup, but log warning
}

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface DocumentAnalysisResult {
  extractedText: string;
  documentType: string;
  confidence: number;
  language: string;
  extractedFields: {
    claimNumber?: string;
    applicantName?: string;
    state?: string;
    district?: string;
    village?: string;
    area?: number;
    landType?: string;
    submissionDate?: string;
    status?: string;
  };
}

export interface DocumentClassification {
  type: 'fra_claim' | 'identity_proof' | 'land_record' | 'other';
  confidence: number;
  language: string;
}

/**
 * Analyzes FRA documents for content extraction and classification
 */
export async function analyzeDocument(imageBuffer: Buffer, mimeType: string): Promise<DocumentAnalysisResult> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY not configured");
  }
  
  try {
    const prompt = `Analyze this Forest Rights Act document image and extract information in JSON format:
{
  "extractedText": "all text from document",
  "documentType": "FRA Claim Form",
  "confidence": 0.95,
  "language": "Hindi",
  "extractedFields": {
    "claimNumber": "extracted claim number",
    "applicantName": "extracted name",
    "state": "state name",
    "district": "district name", 
    "village": "village name",
    "area": 5.5,
    "landType": "individual",
    "submissionDate": "2024-01-01",
    "status": "pending"
  }
}`;

    const response = await genAI.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        { text: prompt },
        {
          inlineData: {
            data: imageBuffer.toString("base64"),
            mimeType: mimeType,
          },
        }
      ]
    });

    const text = response.text;
    if (text) {
      try {
        // Extract JSON from response
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const data: DocumentAnalysisResult = JSON.parse(jsonMatch[0]);
          return data;
        }
      } catch (parseError) {
        console.error('Failed to parse AI response:', text);
      }
    }
    
    // Fallback response
    return {
      extractedText: text || "Could not extract text",
      documentType: "Unknown",
      confidence: 0.5,
      language: "Unknown",
      extractedFields: {}
    };
  } catch (error) {
    console.error('Gemini document analysis error:', error);
    throw new Error(`Failed to analyze document with AI: ${error}`);
  }
}

/**
 * Classifies document type for routing in workflow
 */
export async function classifyDocument(imageBuffer: Buffer, mimeType: string): Promise<DocumentClassification> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY not configured");
  }
  
  try {
    const prompt = `Classify this document type and language. Reply with JSON:
{
  "type": "fra_claim",
  "confidence": 0.95,
  "language": "Hindi"
}`;

    const response = await genAI.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        { text: prompt },
        {
          inlineData: {
            data: imageBuffer.toString("base64"),
            mimeType: mimeType,
          },
        }
      ]
    });

    const text = response.text;
    if (text) {
      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const data: DocumentClassification = JSON.parse(jsonMatch[0]);
          return data;
        }
      } catch (parseError) {
        console.error('Failed to parse AI response:', text);
      }
    }
    
    return {
      type: 'other',
      confidence: 0.5,
      language: 'Unknown'
    };
  } catch (error) {
    console.error('Gemini document classification error:', error);
    throw new Error(`Failed to classify document with AI: ${error}`);
  }
}

/**
 * Extracts multi-language text from document images
 */
export async function extractText(imageBuffer: Buffer, mimeType: string): Promise<{ text: string; language: string; confidence: number }> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY not configured");
  }
  
  try {
    const prompt = `Extract all text from this document. Reply with JSON:
{
  "text": "extracted text content",
  "language": "detected language",
  "confidence": 0.95
}`;

    const response = await genAI.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        { text: prompt },
        {
          inlineData: {
            data: imageBuffer.toString("base64"),
            mimeType: mimeType,
          },
        }
      ]
    });

    const text = response.text;
    if (text) {
      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const data = JSON.parse(jsonMatch[0]);
          return data;
        }
      } catch (parseError) {
        console.error('Failed to parse AI response:', text);
      }
    }
    
    return {
      text: text || "Could not extract text",
      language: "Unknown",
      confidence: 0.5
    };
  } catch (error) {
    console.error('Gemini text extraction error:', error);
    throw new Error(`Failed to extract text with AI: ${error}`);
  }
}

/**
 * Summarizes FRA document content for dashboard views
 */
export async function summarizeDocument(text: string): Promise<string> {
  if (!process.env.GEMINI_API_KEY) {
    return "AI summarization not available - API key not configured";
  }
  
  try {
    const prompt = `Summarize this Forest Rights Act document in 2-3 sentences:\n\n${text}`;

    const response = await genAI.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ text: prompt }]
    });

    return response.text || "Summary not available";
  } catch (error) {
    console.error('Gemini summarization error:', error);
    return "Summary not available";
  }
}