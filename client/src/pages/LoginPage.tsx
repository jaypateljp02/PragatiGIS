import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Shield, TreePine, Users, MapPin, Building, Moon, Sun } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState as useThemeState, useEffect } from "react";

const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

type LoginForm = z.infer<typeof loginSchema>;

function ThemeToggle() {
  const [isDark, setIsDark] = useThemeState(false);

  useEffect(() => {
    const theme = localStorage.getItem('theme');
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initialDark = theme === 'dark' || (!theme && systemPrefersDark);
    
    setIsDark(initialDark);
    document.documentElement.classList.toggle('dark', initialDark);
  }, []);

  const toggleTheme = () => {
    const newTheme = !isDark;
    setIsDark(newTheme);
    localStorage.setItem('theme', newTheme ? 'dark' : 'light');
    document.documentElement.classList.toggle('dark', newTheme);
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleTheme}
      data-testid="button-theme-toggle"
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState("");
  const { toast } = useToast();

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const demoAccounts = [
    {
      role: "ministry",
      title: "Ministry Administrator",
      username: "ministry.admin",
      password: "admin123",
      description: "Full access to all states and national dashboard",
      icon: Shield,
      color: "text-blue-600"
    },
    {
      role: "state",
      title: "State Administrator (MP)",
      username: "mp.admin", 
      password: "state123",
      description: "Access to Madhya Pradesh state data only",
      icon: Building,
      color: "text-green-600"
    },
    {
      role: "district",
      title: "District Officer",
      username: "district.officer",
      password: "district123", 
      description: "Access to specific district claims and documents",
      icon: MapPin,
      color: "text-orange-600"
    },
    {
      role: "village",
      title: "Village Officer", 
      username: "village.officer",
      password: "village123",
      description: "Access to village-level claim submissions",
      icon: Users,
      color: "text-purple-600"
    }
  ];

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true);
    
    try {
      // Make actual API call to backend
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: data.username,
          password: data.password
        }),
        credentials: 'include' // Include cookies for secure session management
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Login failed');
      }

      // Success - user data is returned, session cookie is set automatically
      const user = result.user;
      
      toast({
        title: "Login Successful",
        description: `Welcome to FRA Atlas Platform, ${user.fullName}`,
      });

      // Force a hard refresh to ensure the auth context picks up the new session
      setTimeout(() => {
        window.location.href = "/";
      }, 1000);
      
    } catch (error) {
      console.error('Login error:', error);
      toast({
        variant: "destructive",
        title: "Login Failed",
        description: error instanceof Error ? error.message : "Invalid credentials or server error",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoLogin = (account: typeof demoAccounts[0]) => {
    form.setValue("username", account.username);
    form.setValue("password", account.password);
    setSelectedRole(account.role);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-chart-3/5 flex items-center justify-center p-4">
      {/* Theme Toggle Button - Top Right */}
      <div className="fixed top-4 right-4 z-50">
        <ThemeToggle />
      </div>
      
      <div className="w-full max-w-6xl grid gap-8 lg:grid-cols-2">
        {/* Left side - Branding and Info */}
        <div className="flex flex-col justify-center space-y-6">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-primary/10">
                <TreePine className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-foreground">FRA Atlas Platform</h1>
                <p className="text-muted-foreground">Forest Rights Act Management System</p>
              </div>
            </div>
            
            <div className="space-y-3">
              <h2 className="text-xl font-semibold">Digital Transformation for Tribal Affairs</h2>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Advanced OCR/NER for multilingual document processing</li>
                <li>• Real-time government data integration</li>
                <li>• Interactive WebGIS mapping capabilities</li>
                <li>• Role-based access for Ministry, State, District & Village officers</li>
                <li>• Comprehensive analytics and reporting dashboard</li>
              </ul>
            </div>

            <Alert>
              <Shield className="h-4 w-4" />
              <AlertDescription>
                Secure government platform with institutional-grade security for Ministry of Tribal Affairs
              </AlertDescription>
            </Alert>
          </div>

          {/* Demo Accounts Grid */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Demo Accounts</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {demoAccounts.map((account) => {
                const Icon = account.icon;
                return (
                  <Card 
                    key={account.role}
                    className={`cursor-pointer hover-elevate transition-colors border-l-4 ${
                      selectedRole === account.role ? 'border-l-primary bg-primary/5' : 'border-l-muted'
                    }`}
                    onClick={() => handleDemoLogin(account)}
                    data-testid={`demo-account-${account.role}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <Icon className={`h-5 w-5 mt-0.5 ${account.color}`} />
                        <div className="space-y-1 flex-1">
                          <h4 className="font-medium text-sm">{account.title}</h4>
                          <p className="text-xs text-muted-foreground">{account.description}</p>
                          <div className="text-xs font-mono bg-muted/50 px-2 py-1 rounded">
                            {account.username} / {account.password}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right side - Login Form */}
        <div className="flex flex-col justify-center">
          <Card className="w-full max-w-md mx-auto">
            <CardHeader className="space-y-2 text-center">
              <CardTitle className="text-2xl">Secure Login</CardTitle>
              <CardDescription>
                Access the FRA Atlas Platform with your government credentials
              </CardDescription>
            </CardHeader>
            
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Username</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Enter your username" 
                            {...field}
                            data-testid="input-username"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <Input 
                            type="password" 
                            placeholder="Enter your password" 
                            {...field}
                            data-testid="input-password"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="space-y-2">
                    <Label>User Role</Label>
                    <Select value={selectedRole} onValueChange={setSelectedRole}>
                      <SelectTrigger data-testid="select-user-role">
                        <SelectValue placeholder="Select your role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ministry">Ministry Administrator</SelectItem>
                        <SelectItem value="state">State Administrator</SelectItem>
                        <SelectItem value="district">District Officer</SelectItem>
                        <SelectItem value="village">Village Officer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={isLoading}
                    data-testid="button-login"
                  >
                    {isLoading ? "Logging in..." : "Login"}
                  </Button>
                </form>
              </Form>

              <div className="mt-6 text-center text-sm text-muted-foreground">
                <p>For production access, contact IT administration</p>
                <p className="mt-1">help@tribal.gov.in • 1800-123-4567</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}