import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  FileText, Download, Calendar, BarChart3, Brain, 
  TreePine, Users, CheckCircle2, AlertTriangle, Settings 
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';
import { Claim } from "./ClaimsTable";

interface DashboardStats {
  totalClaims: number;
  approvedClaims: number;
  pendingClaims: number;
  underReviewClaims: number;
  rejectedClaims: number;
  totalArea: string;
  totalDocuments?: number;
  processedDocuments?: number;
}

interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  type: 'analytics' | 'claims' | 'dss' | 'compliance' | 'environmental';
  format: 'pdf' | 'csv' | 'excel';
}

interface ReportOptions {
  template: string;
  format: 'pdf' | 'csv' | 'excel';
  dateRange: 'week' | 'month' | 'quarter' | 'year' | 'custom';
  stateFilter?: string;
  districtFilter?: string;
}

interface ReportGeneratorProps {
  claims?: Claim[];
}

export default function ReportGenerator({ claims = [] }: ReportGeneratorProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [reportOptions, setReportOptions] = useState<ReportOptions>({
    template: 'claims-summary',
    format: 'pdf',
    dateRange: 'month',
    stateFilter: 'all',
    districtFilter: 'all'
  });
  
  const reportRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { t } = useLanguage();

  // Fetch dashboard stats for reports
  const { data: dashboardStats } = useQuery<DashboardStats>({
    queryKey: ['/api/dashboard/stats'],
    enabled: true,
  });

  const reportTemplates: ReportTemplate[] = [
    {
      id: 'claims-summary',
      name: t('pages.reports.templates.claimsSummary', 'Claims Summary'),
      description: t('pages.reports.templates.claimsSummaryDesc', 'Detailed summary of all claims data'),
      icon: <FileText className="h-5 w-5" />,
      type: 'claims',
      format: 'pdf'
    },
    {
      id: 'dss-analysis',
      name: t('pages.reports.templates.dssAnalysis', 'DSS Analysis Report'),
      description: t('pages.reports.templates.dssAnalysisDesc', 'AI-powered insights and recommendations'),
      icon: <Brain className="h-5 w-5" />,
      type: 'dss',
      format: 'pdf'
    },
    {
      id: 'compliance',
      name: t('pages.reports.templates.compliance', 'Compliance Report'),
      description: t('pages.reports.templates.complianceDesc', 'Policy adherence and audit trails'),
      icon: <CheckCircle2 className="h-5 w-5" />,
      type: 'compliance',
      format: 'pdf'
    },
    {
      id: 'environmental',
      name: t('pages.reports.templates.environmental', 'Environmental Impact'),
      description: t('pages.reports.templates.environmentalDesc', 'Forest cover and ecological analysis'),
      icon: <TreePine className="h-5 w-5" />,
      type: 'environmental',
      format: 'pdf'
    },
    {
      id: 'data-export',
      name: t('pages.reports.templates.dataExport', 'Data Export'),
      description: t('pages.reports.templates.dataExportDesc', 'Raw data in Excel/CSV format'),
      icon: <Download className="h-5 w-5" />,
      type: 'claims',
      format: 'excel'
    }
  ];

  // Helper function to filter claims based on report options
  const getFilteredClaims = () => {
    let filteredClaims = [...claims];
    
    // Apply state filter
    if (reportOptions.stateFilter && reportOptions.stateFilter !== 'all') {
      filteredClaims = filteredClaims.filter(claim => claim.state === reportOptions.stateFilter);
    }
    
    // Apply district filter
    if (reportOptions.districtFilter && reportOptions.districtFilter !== 'all') {
      filteredClaims = filteredClaims.filter(claim => claim.district === reportOptions.districtFilter);
    }
    
    // Apply date range filter
    const now = new Date();
    let cutoffDate = new Date();
    
    switch (reportOptions.dateRange) {
      case 'week':
        cutoffDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        cutoffDate.setMonth(now.getMonth() - 1);
        break;
      case 'quarter':
        cutoffDate.setMonth(now.getMonth() - 3);
        break;
      case 'year':
        cutoffDate.setFullYear(now.getFullYear() - 1);
        break;
      default:
        return filteredClaims; // No date filtering
    }
    
    filteredClaims = filteredClaims.filter(claim => {
      const claimDate = new Date(claim.dateSubmitted);
      return claimDate >= cutoffDate;
    });
    
    return filteredClaims;
  };
  
  // Helper function to get filtered dashboard stats
  const getFilteredStats = (filteredClaims: Claim[]) => {
    const approved = filteredClaims.filter(c => c.status === 'approved').length;
    const pending = filteredClaims.filter(c => c.status === 'pending').length;
    const underReview = filteredClaims.filter(c => c.status === 'under-review').length;
    const rejected = filteredClaims.filter(c => c.status === 'rejected').length;
    const totalArea = filteredClaims.reduce((sum, c) => sum + (c.area || 0), 0);
    
    return {
      totalClaims: filteredClaims.length,
      approvedClaims: approved,
      pendingClaims: pending,
      underReviewClaims: underReview,
      rejectedClaims: rejected,
      totalArea: `${totalArea.toLocaleString()} hectares`
    };
  };
  
  
  
  const generatePDFReport = async () => {
    setIsGenerating(true);
    setGenerationProgress(10);

    try {
      const filteredClaims = getFilteredClaims();
      const filteredStats = getFilteredStats(filteredClaims);
      const selectedTemplate = reportTemplates.find(t => t.id === reportOptions.template);
      
      // Create PDF
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      let currentY = 30;
      
      setGenerationProgress(20);
      
      // Add header with branding
      pdf.setFontSize(24);
      pdf.setTextColor(34, 197, 94); // Green color
      pdf.text('FRA Atlas Report', 20, currentY);
      currentY += 20;
      
      // Report details
      pdf.setFontSize(12);
      pdf.setTextColor(0, 0, 0);
      pdf.text(`Report Type: ${selectedTemplate?.name || 'Unknown'}`, 20, currentY);
      currentY += 8;
      pdf.text(`Generated on: ${new Date().toLocaleDateString()}`, 20, currentY);
      currentY += 8;
      
      // Report criteria
      if (reportOptions.stateFilter && reportOptions.stateFilter !== 'all') {
        pdf.text(`State Filter: ${reportOptions.stateFilter}`, 20, currentY);
        currentY += 8;
      }
      if (reportOptions.districtFilter && reportOptions.districtFilter !== 'all') {
        pdf.text(`District Filter: ${reportOptions.districtFilter}`, 20, currentY);
        currentY += 8;
      }
      pdf.text(`Date Range: ${reportOptions.dateRange}`, 20, currentY);
      currentY += 15;
      
      setGenerationProgress(30);
      
      // Add executive summary
      pdf.setFontSize(16);
      pdf.setTextColor(75, 85, 99);
      pdf.text('Executive Summary', 20, currentY);
      currentY += 10;
      
      pdf.setFontSize(11);
      pdf.setTextColor(0, 0, 0);
      pdf.text(`Total Claims Analyzed: ${filteredStats.totalClaims.toLocaleString()}`, 20, currentY);
      currentY += 7;
      pdf.text(`Approved Claims: ${filteredStats.approvedClaims.toLocaleString()}`, 20, currentY);
      currentY += 7;
      pdf.text(`Pending Claims: ${filteredStats.pendingClaims.toLocaleString()}`, 20, currentY);
      currentY += 7;
      pdf.text(`Rejected Claims: ${filteredStats.rejectedClaims.toLocaleString()}`, 20, currentY);
      currentY += 7;
      pdf.text(`Total Area Covered: ${filteredStats.totalArea}`, 20, currentY);
      currentY += 15;
      
      setGenerationProgress(50);
      
      // Template-specific content
      switch (reportOptions.template) {
        case 'dss-analysis':
          currentY = await addDSSContent(pdf, filteredClaims, currentY, pageHeight);
          break;
        case 'compliance':
          currentY = await addComplianceContent(pdf, filteredClaims, currentY, pageHeight);
          break;
        case 'environmental':
          currentY = await addEnvironmentalContent(pdf, filteredClaims, currentY, pageHeight);
          break;
        case 'claims-summary':
          currentY = await addClaimsSummaryContent(pdf, filteredClaims, currentY, pageHeight);
          break;
      }
      
      setGenerationProgress(80);
      
      
      setGenerationProgress(90);
      
      // Add footer to all pages
      const totalPages = pdf.internal.pages.length - 1;
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        const footerY = pageHeight - 15;
        pdf.setFontSize(8);
        pdf.setTextColor(107, 114, 128);
        pdf.text('Generated by FRA Atlas Platform', 20, footerY);
        pdf.text(`Page ${i} of ${totalPages}`, pageWidth - 40, footerY);
      }
      
      setGenerationProgress(100);
      
      // Save the PDF
      const fileName = `fra-report-${reportOptions.template}-${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);
      
      toast({
        title: t('pages.reports.reportGenerated', 'Report Generated'),
        description: t('pages.reports.reportSuccess', `PDF report saved as ${fileName}`),
      });
      
    } catch (error) {
      console.error('PDF generation failed:', error);
      toast({
        title: t('pages.reports.reportError', 'Generation Failed'),
        description: t('pages.reports.reportFailed', 'Failed to generate PDF report'),
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
      setGenerationProgress(0);
    }
  };

  // Template-specific content functions
  
  const addDSSContent = async (pdf: jsPDF, filteredClaims: Claim[], startY: number, pageHeight: number): Promise<number> => {
    let currentY = startY;
    
    pdf.setFontSize(16);
    pdf.setTextColor(75, 85, 99);
    pdf.text('Decision Support System Analysis', 20, currentY);
    currentY += 15;
    
    pdf.setFontSize(11);
    pdf.setTextColor(0, 0, 0);
    
    // Risk analysis summary
    const highRiskClaims = filteredClaims.filter(c => (c.area || 0) > 50).length;
    const communityRights = filteredClaims.filter(c => c.landType === 'community').length;
    
    pdf.text('AI-Powered Risk Assessment:', 20, currentY);
    currentY += 10;
    pdf.text(`High Risk Claims (>50 hectares): ${highRiskClaims}`, 25, currentY);
    currentY += 7;
    pdf.text(`Community Rights Claims: ${communityRights}`, 25, currentY);
    currentY += 7;
    pdf.text(`Individual Rights Claims: ${filteredClaims.length - communityRights}`, 25, currentY);
    currentY += 10;
    
    // Policy compliance insights
    pdf.text('Policy Compliance Overview:', 20, currentY);
    currentY += 10;
    const compliantClaims = filteredClaims.filter(c => (c.area || 0) <= 100).length;
    pdf.text(`Claims within area limits: ${compliantClaims}/${filteredClaims.length}`, 25, currentY);
    currentY += 7;
    
    // Recommendations
    currentY += 5;
    pdf.text('AI Recommendations:', 20, currentY);
    currentY += 10;
    const recommendations = [
      'Prioritize review of large area claims (>50 hectares)',
      'Expedite processing of compliant individual claims',
      'Conduct field verification for community rights claims',
      'Focus on environmental impact assessment for forest areas'
    ];
    
    recommendations.forEach((rec, index) => {
      if (currentY > pageHeight - 40) {
        pdf.addPage();
        currentY = 30;
      }
      pdf.text(`${index + 1}. ${rec}`, 25, currentY);
      currentY += 7;
    });
    
    return currentY + 10;
  };
  
  const addComplianceContent = async (pdf: jsPDF, filteredClaims: Claim[], startY: number, pageHeight: number): Promise<number> => {
    let currentY = startY;
    
    pdf.setFontSize(16);
    pdf.setTextColor(75, 85, 99);
    pdf.text('Compliance Report', 20, currentY);
    currentY += 15;
    
    pdf.setFontSize(11);
    pdf.setTextColor(0, 0, 0);
    
    // Policy adherence metrics
    const withinAreaLimits = filteredClaims.filter(c => (c.area || 0) <= 100).length;
    const complianceRate = filteredClaims.length > 0 ? (withinAreaLimits / filteredClaims.length * 100).toFixed(1) : '0';
    
    pdf.text('Policy Adherence Metrics:', 20, currentY);
    currentY += 10;
    pdf.text(`Area Limit Compliance: ${complianceRate}%`, 25, currentY);
    currentY += 7;
    pdf.text(`Claims within 100 hectares: ${withinAreaLimits}/${filteredClaims.length}`, 25, currentY);
    currentY += 10;
    
    // Audit trail summary
    pdf.text('Audit Trail Summary:', 20, currentY);
    currentY += 10;
    pdf.text(`Total claims processed: ${filteredClaims.length}`, 25, currentY);
    currentY += 7;
    pdf.text(`Processing completion rate: ${(filteredClaims.filter(c => c.status !== 'pending').length / filteredClaims.length * 100).toFixed(1)}%`, 25, currentY);
    currentY += 10;
    
    // Compliance violations
    const violations = filteredClaims.filter(c => (c.area || 0) > 100);
    if (violations.length > 0) {
      pdf.text('Potential Compliance Issues:', 20, currentY);
      currentY += 10;
      violations.slice(0, 5).forEach(claim => {
        if (currentY > pageHeight - 40) {
          pdf.addPage();
          currentY = 30;
        }
        pdf.text(`Claim ${claim.id}: ${claim.area} hectares (exceeds 100ha limit)`, 25, currentY);
        currentY += 7;
      });
    }
    
    return currentY + 10;
  };
  
  const addEnvironmentalContent = async (pdf: jsPDF, filteredClaims: Claim[], startY: number, pageHeight: number): Promise<number> => {
    let currentY = startY;
    
    pdf.setFontSize(16);
    pdf.setTextColor(75, 85, 99);
    pdf.text('Environmental Impact Analysis', 20, currentY);
    currentY += 15;
    
    pdf.setFontSize(11);
    pdf.setTextColor(0, 0, 0);
    
    // Forest cover analysis
    const totalArea = filteredClaims.reduce((sum, c) => sum + (c.area || 0), 0);
    const forestClaims = filteredClaims.filter(c => c.landType && c.landType.toLowerCase().includes('forest')).length;
    
    pdf.text('Forest Cover Analysis:', 20, currentY);
    currentY += 10;
    pdf.text(`Total area under claims: ${totalArea.toLocaleString()} hectares`, 25, currentY);
    currentY += 7;
    pdf.text(`Forest-related claims: ${forestClaims}/${filteredClaims.length}`, 25, currentY);
    currentY += 10;
    
    // Environmental impact categories
    const highImpact = filteredClaims.filter(c => (c.area || 0) > 50).length;
    const mediumImpact = filteredClaims.filter(c => (c.area || 0) > 20 && (c.area || 0) <= 50).length;
    const lowImpact = filteredClaims.filter(c => (c.area || 0) <= 20).length;
    
    pdf.text('Environmental Impact Categories:', 20, currentY);
    currentY += 10;
    pdf.text(`High Impact (>50ha): ${highImpact} claims`, 25, currentY);
    currentY += 7;
    pdf.text(`Medium Impact (20-50ha): ${mediumImpact} claims`, 25, currentY);
    currentY += 7;
    pdf.text(`Low Impact (≤20ha): ${lowImpact} claims`, 25, currentY);
    currentY += 10;
    
    // Conservation recommendations
    pdf.text('Conservation Recommendations:', 20, currentY);
    currentY += 10;
    const ecoRecommendations = [
      'Implement sustainable forest management practices',
      'Establish buffer zones around critical habitats',
      'Monitor biodiversity impact in high-impact areas',
      'Promote community-based conservation initiatives'
    ];
    
    ecoRecommendations.forEach((rec, index) => {
      if (currentY > pageHeight - 40) {
        pdf.addPage();
        currentY = 30;
      }
      pdf.text(`${index + 1}. ${rec}`, 25, currentY);
      currentY += 7;
    });
    
    return currentY + 10;
  };
  
  const addClaimsSummaryContent = async (pdf: jsPDF, filteredClaims: Claim[], startY: number, pageHeight: number): Promise<number> => {
    let currentY = startY;
    
    pdf.setFontSize(16);
    pdf.setTextColor(75, 85, 99);
    pdf.text('Detailed Claims Summary', 20, currentY);
    currentY += 15;
    
    pdf.setFontSize(9);
    pdf.setTextColor(0, 0, 0);
    
    // Table header
    pdf.text('ID', 20, currentY);
    pdf.text('Claimant', 40, currentY);
    pdf.text('Location', 80, currentY);
    pdf.text('Area (ha)', 120, currentY);
    pdf.text('Status', 145, currentY);
    pdf.text('Type', 165, currentY);
    currentY += 7;
    
    // Draw line under header
    pdf.line(20, currentY - 2, 185, currentY - 2);
    currentY += 3;
    
    // Claims data (limit to first 50 to prevent huge PDFs)
    const displayClaims = filteredClaims.slice(0, 50);
    
    displayClaims.forEach((claim) => {
      if (currentY > pageHeight - 30) {
        pdf.addPage();
        currentY = 30;
        // Repeat header on new page
        pdf.text('ID', 20, currentY);
        pdf.text('Claimant', 40, currentY);
        pdf.text('Location', 80, currentY);
        pdf.text('Area (ha)', 120, currentY);
        pdf.text('Status', 145, currentY);
        pdf.text('Type', 165, currentY);
        currentY += 7;
        pdf.line(20, currentY - 2, 185, currentY - 2);
        currentY += 3;
      }
      
      pdf.text(claim.id.substring(0, 15), 20, currentY);
      pdf.text((claim.claimantName || '').substring(0, 25), 40, currentY);
      pdf.text((claim.location || '').substring(0, 25), 80, currentY);
      pdf.text((claim.area || 0).toString(), 120, currentY);
      pdf.text(claim.status, 145, currentY);
      pdf.text((claim.landType || '').substring(0, 15), 165, currentY);
      currentY += 6;
    });
    
    if (filteredClaims.length > 50) {
      currentY += 5;
      pdf.text(`... and ${filteredClaims.length - 50} more claims`, 20, currentY);
      currentY += 7;
    }
    
    return currentY + 10;
  };

  const generateExcelReport = async () => {
    setIsGenerating(true);
    setGenerationProgress(20);

    try {
      const filteredClaims = getFilteredClaims();
      const filteredStats = getFilteredStats(filteredClaims);
      
      // Create workbook
      const wb = XLSX.utils.book_new();
      
      setGenerationProgress(40);
      
      // Add filtered claims data sheet
      if (filteredClaims.length > 0) {
        const claimsData = filteredClaims.map(claim => ({
          'Claim ID': claim.id,
          'Claimant Name': claim.claimantName,
          'Location': claim.location,
          'District': claim.district,
          'State': claim.state,
          'Area (hectares)': claim.area,
          'Land Type': claim.landType,
          'Status': claim.status,
          'Date Submitted': claim.dateSubmitted
        }));
        
        const ws1 = XLSX.utils.json_to_sheet(claimsData);
        XLSX.utils.book_append_sheet(wb, ws1, 'Filtered Claims Data');
      }
      
      setGenerationProgress(60);
      
      // Add filtered statistics sheet
      const statsData = [
        { Metric: 'Total Claims', Value: filteredStats.totalClaims },
        { Metric: 'Approved Claims', Value: filteredStats.approvedClaims },
        { Metric: 'Pending Claims', Value: filteredStats.pendingClaims },
        { Metric: 'Rejected Claims', Value: filteredStats.rejectedClaims },
        { Metric: 'Under Review Claims', Value: filteredStats.underReviewClaims },
        { Metric: 'Total Area', Value: filteredStats.totalArea },
        { Metric: 'Date Range', Value: reportOptions.dateRange },
        { Metric: 'State Filter', Value: reportOptions.stateFilter || 'All' },
        { Metric: 'District Filter', Value: reportOptions.districtFilter || 'All' }
      ];
      
      const ws2 = XLSX.utils.json_to_sheet(statsData);
      XLSX.utils.book_append_sheet(wb, ws2, 'Report Statistics');
      
      
      setGenerationProgress(80);
      
      // Save the Excel file
      const fileName = `fra-report-${reportOptions.template}-${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, fileName);
      
      setGenerationProgress(100);
      
      toast({
        title: t('pages.reports.reportGenerated', 'Report Generated'),
        description: t('pages.reports.reportSuccess', `Excel report saved as ${fileName}. Contains ${filteredClaims.length} filtered claims.`),
      });
      
    } catch (error) {
      console.error('Excel generation failed:', error);
      toast({
        title: t('pages.reports.reportError', 'Generation Failed'),
        description: t('pages.reports.reportFailed', 'Failed to generate Excel report'),
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
      setGenerationProgress(0);
    }
  };

  const generateCSVReport = async () => {
    setIsGenerating(true);
    setGenerationProgress(30);
    
    try {
      const filteredClaims = getFilteredClaims();
      
      // Generate CSV content manually with filtered data
      const headers = [
        'Claim ID',
        'Claimant Name',
        'Location',
        'District',
        'State',
        'Area (hectares)',
        'Land Type',
        'Status',
        'Date Submitted'
      ];
      
      setGenerationProgress(50);
      
      const csvContent = [headers.join(',')];
      
      filteredClaims.forEach(claim => {
        const row = [
          `"${claim.id}"`,
          `"${claim.claimantName || ''}"`,
          `"${claim.location || ''}"`,
          `"${claim.district || ''}"`,
          `"${claim.state || ''}"`,
          `"${claim.area || 0}"`,
          `"${claim.landType || ''}"`,
          `"${claim.status}"`,
          `"${claim.dateSubmitted}"`
        ];
        csvContent.push(row.join(','));
      });
      
      setGenerationProgress(80);
      
      // Create and download CSV
      const csvString = csvContent.join('\n');
      const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `fra-report-${reportOptions.template}-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      setGenerationProgress(100);
      
      toast({
        title: t('pages.reports.reportGenerated', 'Report Generated'),
        description: t('pages.reports.reportSuccess', `CSV report downloaded successfully. Contains ${filteredClaims.length} filtered claims.`),
      });
      
    } catch (error) {
      console.error('CSV generation failed:', error);
      toast({
        title: t('pages.reports.reportError', 'Generation Failed'),
        description: t('pages.reports.reportFailed', 'Failed to generate CSV report'),
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
      setGenerationProgress(0);
    }
  };

  const handleGenerateReport = async () => {
    switch (reportOptions.format) {
      case 'pdf':
        await generatePDFReport();
        break;
      case 'excel':
        await generateExcelReport();
        break;
      case 'csv':
        await generateCSVReport();
        break;
      default:
        toast({
          title: t('pages.reports.reportError', 'Unsupported Format'),
          description: t('pages.reports.reportFailed', 'Selected format is not supported'),
          variant: "destructive"
        });
    }
  };

  const selectedTemplate = reportTemplates.find(t => t.id === reportOptions.template);

  return (
    <div className="space-y-6" data-testid="report-generator">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{t('pages.reports.generateReports', 'Report Generator')}</h2>
          <p className="text-muted-foreground">
            {t('pages.reports.subtitle', 'Generate comprehensive reports and export data from the FRA Atlas Platform')}
          </p>
        </div>
        <Badge variant="outline" className="gap-2">
          <FileText className="h-3 w-3" />
          {t('pages.reports.generateReports', 'Report Builder')}
        </Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Report Templates */}
        <div className="lg:col-span-2">
          <Card data-testid="report-templates">
            <CardHeader>
              <CardTitle>{t('pages.reports.reportTemplates', 'Report Templates')}</CardTitle>
              <CardDescription>
                {t('pages.reports.choosePreBuilt', 'Choose from pre-built report templates')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                {reportTemplates.map((template) => (
                  <Card 
                    key={template.id}
                    className={`cursor-pointer transition-colors hover-elevate ${
                      reportOptions.template === template.id 
                        ? 'border-primary bg-primary/5' 
                        : 'border-border'
                    }`}
                    onClick={() => setReportOptions(prev => ({ 
                      ...prev, 
                      template: template.id,
                      format: template.format 
                    }))}
                    data-testid={`template-${template.id}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-primary/10">
                          {template.icon}
                        </div>
                        <div className="flex-1">
                          <h4 className="font-medium">{template.name}</h4>
                          <p className="text-sm text-muted-foreground mt-1">
                            {template.description}
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="secondary" className="text-xs">
                              {template.format.toUpperCase()}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {template.type}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Report Options */}
        <div>
          <Card data-testid="report-options">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                {t('pages.reports.reportOptions', 'Report Options')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">{t('pages.reports.outputFormat', 'Output Format')}</label>
                <Select 
                  value={reportOptions.format} 
                  onValueChange={(value: 'pdf' | 'csv' | 'excel') => 
                    setReportOptions(prev => ({ ...prev, format: value }))
                  }
                >
                  <SelectTrigger data-testid="select-format">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pdf">PDF Report</SelectItem>
                    <SelectItem value="excel">Excel Spreadsheet</SelectItem>
                    <SelectItem value="csv">CSV Data</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium">{t('pages.reports.dateRange', 'Date Range')}</label>
                <Select 
                  value={reportOptions.dateRange} 
                  onValueChange={(value: 'week' | 'month' | 'quarter' | 'year' | 'custom') => 
                    setReportOptions(prev => ({ ...prev, dateRange: value }))
                  }
                >
                  <SelectTrigger data-testid="select-date-range">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="week">{t('pages.reports.week', 'Last Week')}</SelectItem>
                    <SelectItem value="month">{t('pages.reports.month', 'Last Month')}</SelectItem>
                    <SelectItem value="quarter">{t('pages.reports.quarter', 'Last Quarter')}</SelectItem>
                    <SelectItem value="year">{t('pages.reports.year', 'Last Year')}</SelectItem>
                    <SelectItem value="custom">{t('pages.reports.custom', 'Custom Range')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium">{t('pages.reports.stateFilter', 'State Filter')}</label>
                <Select 
                  value={reportOptions.stateFilter || 'all'} 
                  onValueChange={(value) => 
                    setReportOptions(prev => ({ ...prev, stateFilter: value }))
                  }
                >
                  <SelectTrigger data-testid="select-state-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('common.all', 'All States')}</SelectItem>
                    <SelectItem value="Madhya Pradesh">Madhya Pradesh</SelectItem>
                    <SelectItem value="Maharashtra">Maharashtra</SelectItem>
                    <SelectItem value="Odisha">Odisha</SelectItem>
                    <SelectItem value="Gujarat">Gujarat</SelectItem>
                    <SelectItem value="Telangana">Telangana</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              

              {selectedTemplate && (
                <div className="p-3 rounded-lg bg-muted">
                  <div className="flex items-center gap-2 mb-2">
                    {selectedTemplate.icon}
                    <span className="font-medium text-sm">{selectedTemplate.name}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {selectedTemplate.description}
                  </p>
                </div>
              )}

              {isGenerating && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>{t('pages.reports.generatingReport', 'Generating report...')}</span>
                    <span>{generationProgress}%</span>
                  </div>
                  <Progress value={generationProgress} className="w-full" />
                </div>
              )}

              <Button 
                onClick={handleGenerateReport}
                disabled={isGenerating}
                className="w-full"
                data-testid="button-generate-report"
              >
                {isGenerating ? (
                  <>
                    <span className="animate-spin mr-2">⏳</span>
                    {t('common.generating', 'Generating...')}
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    {t('pages.reports.generateReport', 'Generate Report')}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <Card className="mt-4" data-testid="quick-stats">
            <CardHeader>
              <CardTitle className="text-sm">{t('navigation.quickStats', 'Quick Stats')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('pages.reports.claimsAvailable', 'Available Claims')}</span>
                <span className="font-medium">{claims.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('pages.reports.filteredClaims', 'Filtered Claims')}</span>
                <span className="font-medium text-primary">{getFilteredClaims().length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('pages.reports.totalClaims', 'Total Reports')}</span>
                <span className="font-medium">{reportTemplates.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('pages.reports.multipleFormats', 'Formats')}</span>
                <span className="font-medium">PDF, Excel, CSV</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Hidden div for PDF generation */}
      <div ref={reportRef} className="hidden">
        {/* This div can be used for more complex PDF layouts */}
      </div>
      
    </div>
  );
}