import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { 
  User, 
  Bell, 
  Shield, 
  Database,
  Globe,
  Settings as SettingsIcon,
  Save,
  Key,
  MapPin
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function SettingsPage() {
  const { toast } = useToast();
  const [notifications, setNotifications] = useState({
    emailAlerts: true,
    claimUpdates: true,
    systemNotifications: false,
    weeklyReports: true
  });

  const [userSettings, setUserSettings] = useState({
    displayName: "Admin User",
    email: "admin@tribal.gov.in",
    phone: "+91 98765 43210",
    department: "Ministry of Tribal Affairs",
    location: "New Delhi"
  });

  const handleSaveSettings = () => {
    toast({
      title: "Settings Saved",
      description: "Your preferences have been updated successfully.",
    });
  };

  return (
    <div className="space-y-6" data-testid="settings-page">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account preferences and system configurations
        </p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="system">System</TabsTrigger>
        </TabsList>

        {/* Profile Settings */}
        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Profile Information
              </CardTitle>
              <CardDescription>
                Update your personal information and contact details
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-4">
                <Avatar className="h-20 w-20">
                  <AvatarFallback className="bg-primary text-primary-foreground text-lg">
                    AU
                  </AvatarFallback>
                </Avatar>
                <div>
                  <Button variant="outline" size="sm" data-testid="button-upload-avatar">
                    Change Avatar
                  </Button>
                  <p className="text-xs text-muted-foreground mt-1">
                    JPG, PNG or GIF. Max size 2MB.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="displayName">Display Name</Label>
                  <Input
                    id="displayName"
                    value={userSettings.displayName}
                    onChange={(e) => setUserSettings(prev => ({ ...prev, displayName: e.target.value }))}
                    data-testid="input-display-name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={userSettings.email}
                    onChange={(e) => setUserSettings(prev => ({ ...prev, email: e.target.value }))}
                    data-testid="input-email"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    value={userSettings.phone}
                    onChange={(e) => setUserSettings(prev => ({ ...prev, phone: e.target.value }))}
                    data-testid="input-phone"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="department">Department</Label>
                  <Input
                    id="department"
                    value={userSettings.department}
                    onChange={(e) => setUserSettings(prev => ({ ...prev, department: e.target.value }))}
                    data-testid="input-department"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    value={userSettings.location}
                    onChange={(e) => setUserSettings(prev => ({ ...prev, location: e.target.value }))}
                    data-testid="input-location"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button onClick={handleSaveSettings} data-testid="button-save-profile">
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </Button>
                <Button variant="outline" data-testid="button-cancel-profile">
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications */}
        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notification Preferences
              </CardTitle>
              <CardDescription>
                Choose what notifications you want to receive
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">Email Alerts</h4>
                  <p className="text-sm text-muted-foreground">
                    Get notified about important updates via email
                  </p>
                </div>
                <Switch
                  checked={notifications.emailAlerts}
                  onCheckedChange={(checked) => 
                    setNotifications(prev => ({ ...prev, emailAlerts: checked }))
                  }
                  data-testid="switch-email-alerts"
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">Claim Status Updates</h4>
                  <p className="text-sm text-muted-foreground">
                    Notifications when claims are approved, rejected, or require action
                  </p>
                </div>
                <Switch
                  checked={notifications.claimUpdates}
                  onCheckedChange={(checked) => 
                    setNotifications(prev => ({ ...prev, claimUpdates: checked }))
                  }
                  data-testid="switch-claim-updates"
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">System Notifications</h4>
                  <p className="text-sm text-muted-foreground">
                    Updates about system maintenance and new features
                  </p>
                </div>
                <Switch
                  checked={notifications.systemNotifications}
                  onCheckedChange={(checked) => 
                    setNotifications(prev => ({ ...prev, systemNotifications: checked }))
                  }
                  data-testid="switch-system-notifications"
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">Weekly Reports</h4>
                  <p className="text-sm text-muted-foreground">
                    Receive weekly summary reports of platform activity
                  </p>
                </div>
                <Switch
                  checked={notifications.weeklyReports}
                  onCheckedChange={(checked) => 
                    setNotifications(prev => ({ ...prev, weeklyReports: checked }))
                  }
                  data-testid="switch-weekly-reports"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security */}
        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Security Settings
              </CardTitle>
              <CardDescription>
                Manage your account security and authentication
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">Password</h4>
                <Button variant="outline" data-testid="button-change-password">
                  <Key className="h-4 w-4 mr-2" />
                  Change Password
                </Button>
                <p className="text-xs text-muted-foreground mt-1">
                  Last changed 30 days ago
                </p>
              </div>

              <Separator />

              <div>
                <h4 className="font-medium mb-2">Two-Factor Authentication</h4>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">Disabled</Badge>
                  <Button variant="outline" size="sm" data-testid="button-enable-2fa">
                    Enable 2FA
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Add an extra layer of security to your account
                </p>
              </div>

              <Separator />

              <div>
                <h4 className="font-medium mb-2">Active Sessions</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 bg-muted rounded-md">
                    <div>
                      <p className="text-sm font-medium">Current Session</p>
                      <p className="text-xs text-muted-foreground">
                        Chrome on Windows • New Delhi, IN
                      </p>
                    </div>
                    <Badge variant="outline" className="bg-chart-3/10">Active</Badge>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="mt-2" data-testid="button-view-sessions">
                  View All Sessions
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* System */}
        <TabsContent value="system" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                System Information
              </CardTitle>
              <CardDescription>
                Platform details and administrative settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label className="text-sm font-medium">Platform Version</Label>
                  <p className="text-sm text-muted-foreground">v2.1.0 (Build 2024.09.12)</p>
                </div>

                <div>
                  <Label className="text-sm font-medium">Last Updated</Label>
                  <p className="text-sm text-muted-foreground">September 12, 2024</p>
                </div>

                <div>
                  <Label className="text-sm font-medium">Database Status</Label>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-chart-3"></div>
                    <p className="text-sm text-muted-foreground">Connected</p>
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium">API Status</Label>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-chart-3"></div>
                    <p className="text-sm text-muted-foreground">Operational</p>
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="font-medium mb-2">Regional Settings</h4>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="timezone">Time Zone</Label>
                    <Input
                      id="timezone"
                      value="Asia/Kolkata (IST)"
                      disabled
                      data-testid="input-timezone"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="language">Display Language</Label>
                    <Input
                      id="language"
                      value="English (India)"
                      disabled
                      data-testid="input-language"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}