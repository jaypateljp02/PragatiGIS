import DashboardStats from '../DashboardStats';

export default function DashboardStatsExample() {
  //todo: remove mock functionality
  const mockStats = {
    totalClaims: 125847,
    pendingClaims: 23456,
    approvedClaims: 89231,
    totalDocuments: 245892,
    processedDocuments: 198432,
    totalArea: "2.47M hectares"
  };

  return <DashboardStats stats={mockStats} />;
}