import ClaimsTable, { type Claim } from '../ClaimsTable';

export default function ClaimsTableExample() {
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
    }
  ];

  return (
    <ClaimsTable 
      claims={mockClaims}
      onViewClaim={(id) => console.log('Viewing claim:', id)}
      onExportData={() => console.log('Exporting claims data')}
    />
  );
}