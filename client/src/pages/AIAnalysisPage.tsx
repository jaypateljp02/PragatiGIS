import AIDocumentAnalyzer from "@/components/AIDocumentAnalyzer";

export default function AIAnalysisPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2" data-testid="heading-ai-analysis">
            AI Document Analysis
          </h1>
          <p className="text-gray-600 max-w-2xl">
            Experience the power of Google Gemini AI for analyzing Forest Rights Act documents. 
            Our AI can extract information from documents in multiple Indian languages including 
            Hindi, Odia, Telugu, Bengali, Gujarati, and English.
          </p>
        </div>
        
        <AIDocumentAnalyzer />
        
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <h3 className="font-semibold text-lg mb-2">Multi-Language Support</h3>
            <p className="text-gray-600 text-sm">
              Supports Hindi, Odia, Telugu, Bengali, Gujarati, and English with high accuracy OCR processing.
            </p>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <h3 className="font-semibold text-lg mb-2">Intelligent Extraction</h3>
            <p className="text-gray-600 text-sm">
              Automatically identifies and extracts key information like claim numbers, names, locations, and land details.
            </p>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <h3 className="font-semibold text-lg mb-2">Document Classification</h3>
            <p className="text-gray-600 text-sm">
              Classifies documents as FRA claims, identity proofs, land records, or other types with confidence scoring.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}