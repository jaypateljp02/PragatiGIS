import { useLocation } from "wouter";
import MapView from "@/components/MapView";
import { type Claim } from "@/components/ClaimsTable";
import { useLanguage } from "@/contexts/LanguageContext";

export default function MapPage() {
  const [, setLocation] = useLocation();
  const { t } = useLanguage();

  const handleClaimClick = (claim: Claim) => {
    console.log('Viewing claim details:', claim.id);
    setLocation(`/claims/${claim.id}`);
  };

  return (
    <div className="space-y-4" data-testid="maps-page">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("pages.maps.title", "Interactive Maps")}</h1>
        <p className="text-muted-foreground">
          {t("pages.maps.subtitle", "Geospatial visualization and analysis of Forest Rights Act claims")}
        </p>
      </div>
      
      <MapView 
        onClaimClick={handleClaimClick}
      />
    </div>
  );
}