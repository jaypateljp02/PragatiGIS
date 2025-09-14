import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { 
  User, 
  Shield, 
  Save,
  Key
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function SettingsPage() {
  const { toast } = useToast();
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

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

  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast({
        variant: "destructive",
        title: "File too large",
        description: "Please select an image smaller than 2MB.",
      });
      return;
    }
    
    // Check file type
    if (!file.type.startsWith('image/')) {
      toast({
        variant: "destructive",
        title: "Invalid file type",
        description: "Please select a valid image file (JPG, PNG, or GIF).",
      });
      return;
    }

    // Create preview
    const previewUrl = URL.createObjectURL(file);
    setAvatarPreview(previewUrl);

    // Upload to server
    setIsUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append('avatar', file);

      const response = await fetch('/api/user/avatar', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to upload avatar');
      }

      toast({
        title: "Avatar Updated",
        description: "Your profile picture has been updated successfully.",
      });
    } catch (error) {
      console.error('Avatar upload failed:', error);
      toast({
        variant: "destructive",
        title: "Upload Failed",
        description: "Failed to update your profile picture. Please try again.",
      });
      // Reset preview on error
      setAvatarPreview(null);
      URL.revokeObjectURL(previewUrl);
    } finally {
      setIsUploadingAvatar(false);
    }
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
          <TabsTrigger value="security">Security</TabsTrigger>
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
                  {avatarPreview && <AvatarImage src={avatarPreview} alt="Avatar preview" />}
                  <AvatarFallback className="bg-primary text-primary-foreground text-lg">
                    AU
                  </AvatarFallback>
                </Avatar>
                <div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    className="hidden"
                    id="avatar-upload"
                    disabled={isUploadingAvatar}
                  />
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => document.getElementById('avatar-upload')?.click()}
                    disabled={isUploadingAvatar}
                    data-testid="button-upload-avatar"
                  >
                    {isUploadingAvatar ? "Uploading..." : "Change Avatar"}
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

      </Tabs>
    </div>
  );
}