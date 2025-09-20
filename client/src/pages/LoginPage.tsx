import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield, LogIn, Eye, EyeOff } from "lucide-react";
import logoImage from "@assets/logobg_1758394737092.png";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import ThemeToggle from "@/components/ThemeToggle";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useLanguage } from "@/contexts/LanguageContext";


export default function LoginPage() {
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { login, isLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { t } = useLanguage();

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      setLocation('/');
    }
  }, [isAuthenticated, setLocation]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoggingIn || !username.trim() || !password.trim()) return;
    
    setIsLoggingIn(true);
    try {
      await login(username.trim(), password);
      toast({
        title: t("auth.loginSuccess", "Login Successful"),
        description: t("auth.welcomeMessage", "Welcome to FRA Atlas Platform"),
      });
    } catch (error: any) {
      console.error('Login error:', error);
      toast({
        variant: "destructive",
        title: t("auth.loginFailed", "Login Failed"),
        description: error.message || t("auth.invalidCredentials", "Invalid username or password. Please try again."),
      });
      setIsLoggingIn(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-blue-50 dark:from-green-950 dark:to-blue-950">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">{t("common.loading", "Loading...")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-green-50 to-blue-50 dark:from-green-950 dark:to-blue-950">
      {/* Header */}
      <header className="w-full p-4 flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <img src={logoImage} alt="FRA Atlas Logo" className="h-8 w-8" />
          <span className="text-2xl font-bold text-gray-900 dark:text-white">{t("header.title", "FRA Atlas")}</span>
        </div>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Hero Section */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <div className="p-3 bg-green-100 dark:bg-green-900 rounded-full">
                <Shield className="h-12 w-12 text-green-600" />
              </div>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              {t("loginPage.welcomeTitle", "Welcome to FRA Atlas Platform")}
            </h1>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              {t("loginPage.description", "Forest Rights Act document management and processing system for India's tribal communities")}
            </p>
          </div>

          {/* Login Card */}
          <Card className="backdrop-blur-sm bg-white/80 dark:bg-gray-900/80 border border-white/20">
            <CardHeader className="text-center">
              <CardTitle className="text-xl">{t("auth.signInSubtitle", "Sign In to Continue")}</CardTitle>
              <CardDescription>
                {t("loginPage.useCredentials", "Use your credentials to access the FRA Atlas Platform")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Username Field */}
                <div className="space-y-2">
                  <Label htmlFor="username">{t("auth.username", "Username")}</Label>
                  <Input
                    id="username"
                    type="text"
                    placeholder={t("auth.usernamePlaceholder", "Enter your username")}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    disabled={isLoggingIn || isLoading}
                    data-testid="input-username"
                    required
                  />
                </div>

                {/* Password Field */}
                <div className="space-y-2">
                  <Label htmlFor="password">{t("auth.password", "Password")}</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder={t("auth.passwordPlaceholder", "Enter your password")}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={isLoggingIn || isLoading}
                      data-testid="input-password"
                      required
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                      disabled={isLoggingIn || isLoading}
                      data-testid="button-toggle-password"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                {/* Sign In Button */}
                <Button
                  type="submit"
                  disabled={isLoggingIn || isLoading || !username.trim() || !password.trim()}
                  className="w-full h-12 text-base"
                  data-testid="button-login"
                >
                  {isLoggingIn ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      {t("auth.signingIn", "Signing in...")}
                    </>
                  ) : (
                    <>
                      <LogIn className="h-5 w-5 mr-2" />
                      {t("auth.signIn", "Sign In")}
                    </>
                  )}
                </Button>
              </form>

              {/* Demo Credentials */}
              <Alert>
                <Shield className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-2">
                    <p className="font-semibold">{t("auth.demoCredentials", "Demo Credentials:")}</p>
                    <div className="text-sm space-y-1">
                      <p><strong>{t("auth.ministry", "Ministry")}:</strong> ministry.admin / admin123</p>
                      <p><strong>{t("auth.state", "State")}:</strong> mp.admin / state123</p>
                      <p><strong>{t("auth.district", "District")}:</strong> district.officer / district123</p>
                      <p><strong>{t("auth.village", "Village")}:</strong> village.officer / village123</p>
                    </div>
                  </div>
                </AlertDescription>
              </Alert>

              {/* Features List */}
              <div className="mt-6 space-y-3">
                <h3 className="font-semibold text-sm text-gray-900 dark:text-white">{t("loginPage.platformFeatures", "Platform Features:")}</h3>
                <ul className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
                  <li>• {t("loginPage.feature1", "Document processing with OCR support")}</li>
                  <li>• {t("loginPage.feature2", "Geospatial claim visualization")}</li>
                  <li>• {t("loginPage.feature3", "Multi-language support (Hindi, Odia, Telugu, Bengali, Gujarati)")}</li>
                  <li>• {t("loginPage.feature4", "Role-based access control")}</li>
                  <li>• {t("loginPage.feature5", "Analytics and reporting dashboard")}</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Footer */}
          <div className="text-center mt-8 text-sm text-gray-500 dark:text-gray-400">
            <p>{t("loginPage.footerText1", "Serving Madhya Pradesh, Odisha, Telangana, and Tripura")}</p>
            <p className="mt-1">{t("loginPage.footerText2", "Ministry of Tribal Affairs, Government of India")}</p>
          </div>
        </div>
      </div>
    </div>
  );
}