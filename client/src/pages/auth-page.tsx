import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChartLine, TrendingUp, BarChart3, PieChart, Bug } from "lucide-react";
import Footer from "@/components/Footer";
import clearLogoPath from "@assets/Clear_Primary_RGB_Logo_2Color_1753909931351.png";

export default function AuthPage() {
  const { user, loginMutation, registerMutation } = useAuth();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("login");

  // Redirect if already logged in - use timeout to avoid setting state during render
  useEffect(() => {
    if (user) {
      setTimeout(() => {
        setLocation("/");
      }, 0);
    }
  }, [user, setLocation]);

  const handleLogin = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    loginMutation.mutate({
      email: formData.get("email") as string,
      password: formData.get("password") as string,
    });
  };

  const handleRegister = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    registerMutation.mutate({
      name: formData.get("name") as string,
      email: formData.get("email") as string,
      password: formData.get("password") as string,
      clientId: "demo-client-id", // This would be set during proper registration flow
      role: "User",
      status: "Active",
    });
  };

  const handleDebugLogin = (role: "Admin" | "User") => {
    loginMutation.mutate({
      email: role === "Admin" ? "admin@clearsight.com" : "user@clearsight.com",
      password: "password123",
    });
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left side - Form */}
      <div className="flex-1 flex items-center justify-center bg-slate-50 px-4 sm:px-6 lg:px-8 py-8 lg:py-0">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <div className="mx-auto mb-6">
              <img 
                src={clearLogoPath} 
                alt="Clear Digital" 
                className="h-12 w-auto mx-auto mb-4"
              />
            </div>
            <h2 className="text-3xl font-bold text-slate-900">Pulse Dashboard™</h2>
            <p className="mt-2 text-sm text-slate-600">Analytics Benchmarking & AI Insights</p>
          </div>

          <Card>
            <CardHeader>
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="login">Login</TabsTrigger>
                  <TabsTrigger value="register">Register</TabsTrigger>
                </TabsList>
              </Tabs>
            </CardHeader>
            <CardContent>
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsContent value="login">
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                      <Label htmlFor="login-email">Email Address</Label>
                      <Input
                        id="login-email"
                        name="email"
                        type="email"
                        required
                        placeholder="Enter your email"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="login-password">Password</Label>
                      <Input
                        id="login-password"
                        name="password"
                        type="password"
                        required
                        placeholder="Enter your password"
                        className="mt-1"
                      />
                    </div>
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={loginMutation.isPending}
                    >
                      {loginMutation.isPending ? "Signing In..." : "Sign In"}
                    </Button>
                  </form>
                  <div className="text-center mt-4">
                    <Link href="/forgot-password">
                      <Button variant="link" className="text-sm">
                        Forgot your password?
                      </Button>
                    </Link>
                  </div>
                </TabsContent>
                <TabsContent value="register">
                  <form onSubmit={handleRegister} className="space-y-4">
                    <div>
                      <Label htmlFor="register-name">Full Name</Label>
                      <Input
                        id="register-name"
                        name="name"
                        type="text"
                        required
                        placeholder="Enter your full name"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="register-email">Email Address</Label>
                      <Input
                        id="register-email"
                        name="email"
                        type="email"
                        required
                        placeholder="Enter your email"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="register-password">Password</Label>
                      <Input
                        id="register-password"
                        name="password"
                        type="password"
                        required
                        placeholder="Create a password"
                        className="mt-1"
                      />
                    </div>
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={registerMutation.isPending}
                    >
                      {registerMutation.isPending ? "Creating Account..." : "Create Account"}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Debug Mode */}
          <Card className="mt-4 border-orange-200 bg-orange-50">
            <CardHeader>
              <CardTitle className="flex items-center text-orange-800">
                <Bug className="h-5 w-5 mr-2" />
                Debug Mode
              </CardTitle>
              <CardDescription className="text-orange-600">
                Quick login for testing (Development Only)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                onClick={() => handleDebugLogin("Admin")}
                variant="outline"
                className="w-full border-orange-300 text-orange-700 hover:bg-orange-100"
                disabled={loginMutation.isPending}
              >
                Login as Admin
              </Button>
              <Button
                onClick={() => handleDebugLogin("User")}
                variant="outline"
                className="w-full border-orange-300 text-orange-700 hover:bg-orange-100"
                disabled={loginMutation.isPending}
              >
                Login as User
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Right side - Hero */}
      <div className="lg:flex-1 bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center p-4 sm:p-6 lg:p-12">
        <div className="max-w-lg text-center w-full">
          <div className="flex justify-center space-x-3 sm:space-x-4 mb-6 lg:mb-8">
            <div className="p-2 sm:p-3 bg-primary/10 rounded-lg">
              <TrendingUp className="h-6 w-6 sm:h-7 sm:w-7 lg:h-8 lg:w-8 text-primary" />
            </div>
            <div className="p-2 sm:p-3 bg-primary/10 rounded-lg">
              <BarChart3 className="h-6 w-6 sm:h-7 sm:w-7 lg:h-8 lg:w-8 text-primary" />
            </div>
            <div className="p-2 sm:p-3 bg-primary/10 rounded-lg">
              <PieChart className="h-6 w-6 sm:h-7 sm:w-7 lg:h-8 lg:w-8 text-primary" />
            </div>
          </div>
          <h3 className="text-lg sm:text-xl lg:text-2xl font-bold text-slate-900 mb-3 lg:mb-4">
            Transform Your Analytics with AI-Powered Insights
          </h3>
          <p className="text-sm sm:text-base lg:text-lg text-slate-600 mb-4 sm:mb-5 lg:mb-6">
            Compare your performance against industry benchmarks, track competitor metrics, 
            and get AI-generated recommendations to improve your digital presence.
          </p>
          <div className="grid grid-cols-1 gap-3 lg:gap-4 text-xs sm:text-sm text-slate-600">
            <div className="flex items-center">
              <div className="w-2 h-2 bg-primary rounded-full mr-3 flex-shrink-0"></div>
              <span>Real-time performance benchmarking</span>
            </div>
            <div className="flex items-center">
              <div className="w-2 h-2 bg-primary rounded-full mr-3 flex-shrink-0"></div>
              <span>AI-powered insights and recommendations</span>
            </div>
            <div className="flex items-center">
              <div className="w-2 h-2 bg-primary rounded-full mr-3 flex-shrink-0"></div>
              <span>Competitor analysis and tracking</span>
            </div>
            <div className="flex items-center">
              <div className="w-2 h-2 bg-primary rounded-full mr-3 flex-shrink-0"></div>
              <span>Industry-specific analytics</span>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
