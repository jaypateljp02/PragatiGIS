import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { useLocation } from "wouter";
import { BarChart3, FileText, Map, Upload, Settings, TreePine, Eye, CheckSquare, Brain, Download } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";

// Moved navigation array inside component to access `t` function

export default function AppSidebar() {
  const [location, navigate] = useLocation();
  const { t } = useLanguage();

  // Define navigation items with translations
  const navigation = [
    {
      title: t("navigation.dashboard", "Dashboard"),
      url: "/",
      icon: BarChart3,
    },
    {
      title: t("navigation.claimsDocuments", "Claims & Documents"),
      url: "/documents",
      icon: FileText,
      badge: "0"
    },
    {
      title: t("navigation.stateAnalytics", "State Analytics"),
      url: "/state-dashboard",
      icon: CheckSquare,
      badge: "OD"
    },
    {
      title: t("navigation.interactiveMaps", "Interactive Maps"),
      url: "/maps",
      icon: Map,
    },
    {
      title: t("navigation.decisionSupport", "Decision Support"),
      url: "/dss",
      icon: Brain,
      badge: "AI"
    },
    {
      title: t("navigation.reports", "Reports"),
      url: "/reports",
      icon: Download,
      badge: "PDF"
    },
    {
      title: t("navigation.settings", "Settings"),
      url: "/settings",
      icon: Settings,
    },
  ];

  // Safety check to ensure navigation is properly defined
  if (!Array.isArray(navigation)) {
    console.error('Navigation array is not properly defined');
    return <div>Loading sidebar...</div>;
  }

  return (
    <Sidebar data-testid="app-sidebar">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
            <TreePine className="h-4 w-4 text-primary-foreground" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">{t("header.title", "FRA Atlas")}</h2>
            <p className="text-xs text-muted-foreground">{t("header.subtitle", "Forest Rights Platform")}</p>
          </div>
        </div>
      </SidebarHeader>
      
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{t("navigation.mainNavigation", "Main Navigation")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigation.map((item) => (
                <SidebarMenuItem key={item.title} data-testid={`sidebar-item-${item.title.toLowerCase().replace(' ', '-')}`}>
                  <SidebarMenuButton 
                    isActive={location === item.url}
                    onClick={() => {
                      console.log(`Navigating to ${item.title}`);
                      navigate(item.url);
                    }}
                    className="flex items-center justify-between w-full"
                  >
                    <div className="flex items-center gap-2">
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </div>
                    {item.badge && (
                      <Badge variant="secondary" className="text-xs">
                        {item.badge}
                      </Badge>
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>{t("navigation.quickStats", "Quick Stats")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <div className="px-3 py-2 text-sm space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">{t("dashboard.pendingReview", "Pending Review")}</span>
                <Badge variant="outline">0</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">{t("dashboard.processing", "Processing")}</span>
                <Badge variant="outline">0</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">{t("dashboard.approvedToday", "Approved Today")}</span>
                <Badge variant="default" className="bg-chart-3">0</Badge>
              </div>
            </div>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      
      <div className="mt-auto p-4 border-t">
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary text-primary-foreground text-xs">
              AD
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">Admin User</p>
            <p className="text-xs text-muted-foreground truncate">Ministry of Tribal Affairs</p>
          </div>
        </div>
      </div>
    </Sidebar>
  );
}