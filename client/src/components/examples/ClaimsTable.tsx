import { useQuery } from "@tanstack/react-query";
import ClaimsTable, { type Claim } from '../ClaimsTable';

export default function ClaimsTableExample() {
  // Fetch real claims data from database
  const { data: claims = [], isLoading, error } = useQuery<Claim[]>({
    queryKey: ['/api/claims'],
    enabled: true,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-2"></div>
          <p className="text-muted-foreground">Loading real FRA claims data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center text-destructive">
          <p>Error loading claims data</p>
          <p className="text-sm text-muted-foreground mt-1">Please check your connection and try again.</p>
        </div>
      </div>
    );
  }

  return (
    <ClaimsTable 
      claims={claims}
      onViewClaim={(id) => console.log('Viewing claim:', id)}
      onExportData={() => console.log('Exporting claims data')}
    />
  );
}
}