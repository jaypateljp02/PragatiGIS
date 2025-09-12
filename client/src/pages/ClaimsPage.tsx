import ClaimsTable, { type Claim } from "@/components/ClaimsTable";

export default function ClaimsPage() {
  //todo: remove mock functionality
  const mockClaims: Claim[] = [
    {
      id: "FRA-MH-2024-001234",
      claimantName: "Ramesh Kumar Tribal Cooperative",
      location: "Gadchiroli Forest Block A",
      district: "Gadchiroli",
      state: "Maharashtra",
      area: 15.75,
      status: "approved",
      dateSubmitted: "2024-03-15",
      landType: "community"
    },
    {
      id: "FRA-OR-2024-005678",
      claimantName: "Sita Devi",
      location: "Koraput Village Settlement",
      district: "Koraput",
      state: "Odisha",
      area: 2.50,
      status: "pending",
      dateSubmitted: "2024-06-22",
      landType: "individual"
    },
    {
      id: "FRA-MP-2024-009876",
      claimantName: "Tribal Development Society",
      location: "Balaghat Reserve Forest",
      district: "Balaghat",
      state: "Madhya Pradesh",
      area: 45.20,
      status: "under-review",
      dateSubmitted: "2024-02-10",
      landType: "community"
    },
    {
      id: "FRA-TG-2024-003456",
      claimantName: "Anjali Gond",
      location: "Adilabad Forest Area",
      district: "Adilabad",
      state: "Telangana",
      area: 3.80,
      status: "rejected",
      dateSubmitted: "2024-01-28",
      landType: "individual"
    },
    {
      id: "FRA-GJ-2024-007890",
      claimantName: "Bhil Community Trust",
      location: "Dang Forest Division",
      district: "The Dangs",
      state: "Gujarat",
      area: 28.90,
      status: "approved",
      dateSubmitted: "2024-04-05",
      landType: "community"
    },
    {
      id: "FRA-WB-2024-004567",
      claimantName: "Sunderbans Fishermen Society",
      location: "Sundarbans Delta Region",
      district: "South 24 Parganas",
      state: "West Bengal",
      area: 12.30,
      status: "pending",
      dateSubmitted: "2024-07-12",
      landType: "community"
    },
    {
      id: "FRA-HP-2024-008901",
      claimantName: "Mountain Village Collective",
      location: "Himachal Hill Forest",
      district: "Shimla",
      state: "Himachal Pradesh",
      area: 8.75,
      status: "under-review",
      dateSubmitted: "2024-05-18",
      landType: "community"
    }
  ];

  return (
    <div data-testid="claims-page">
      <ClaimsTable 
        claims={mockClaims}
        onViewClaim={(id) => console.log('Viewing claim:', id)}
        onExportData={() => console.log('Exporting claims data')}
      />
    </div>
  );
}