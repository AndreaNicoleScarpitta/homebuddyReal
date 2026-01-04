import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ArrowRight, Mail, Lock } from "lucide-react";
import logoImage from "@assets/generated_images/orange_house_logo_with_grey_gear..png";

export default function Login() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [showOtp, setShowOtp] = useState(false);
  const [otp, setOtp] = useState("");

  const handleSendOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      setShowOtp(true);
    }
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (otp) {
      setLocation("/onboarding"); // Redirect to onboarding
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-[-10%] left-[-5%] w-[500px] h-[500px] bg-secondary/20 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md z-10 space-y-8">
        <div className="text-center">
          <img src={logoImage} alt="Home Buddy" className="w-16 h-16 mx-auto rounded-xl shadow-lg mb-6" />
          <h1 className="text-3xl font-heading font-bold text-foreground">Welcome Back</h1>
          <p className="text-muted-foreground mt-2">Sign in to manage your home maintenance plan.</p>
        </div>

        <Card className="border-none shadow-xl bg-white/80 backdrop-blur-sm">
          <CardContent className="p-8">
            {/* Social Login Buttons */}
            <div className="space-y-3">
              <Button variant="outline" className="w-full h-11 bg-white hover:bg-gray-50 text-foreground font-medium border-gray-200" onClick={() => setLocation("/onboarding")}>
                <svg className="mr-2 h-4 w-4" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512"><path fill="currentColor" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"></path></svg>
                Continue with Google
              </Button>
              <Button variant="outline" className="w-full h-11 bg-white hover:bg-gray-50 text-foreground font-medium border-gray-200" onClick={() => setLocation("/onboarding")}>
                <svg className="mr-2 h-4 w-4 text-[#1877F2]" fill="currentColor" viewBox="0 0 24 24"><path d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036c-2.048 0-2.73 1.056-2.73 2.809v1.162h4.438l-.66 3.667h-3.778v7.98h-5.084Z"></path></svg>
                Continue with Facebook
              </Button>
              <Button variant="outline" className="w-full h-11 bg-white hover:bg-gray-50 text-foreground font-medium border-gray-200" onClick={() => setLocation("/onboarding")}>
                <svg className="mr-2 h-4 w-4 text-[#1D9BF0]" fill="currentColor" viewBox="0 0 24 24"><path d="M22.46 6c-.77.35-1.6.58-2.46.69.88-.53 1.56-1.37 1.88-2.38-.83.5-1.75.85-2.72 1.05C18.37 4.5 17.26 4 16 4c-2.35 0-4.27 1.92-4.27 4.29 0 .34.04.67.11.98C8.28 9.09 5.11 7.38 3 4.79c-.37.63-.58 1.37-.58 2.15 0 1.49.75 2.81 1.91 3.56-.71 0-1.37-.2-1.95-.5v.03c0 2.08 1.48 3.82 3.44 4.21a4.22 4.22 0 0 1-1.93.07 4.28 4.28 0 0 0 4 2.98 8.521 8.521 0 0 1-5.33 1.84c-.34 0-.68-.02-1.02-.06C3.44 20.29 5.7 21 8.12 21 16 21 20.33 14.46 20.33 8.79c0-.19 0-.37-.01-.56.84-.6 1.56-1.36 2.14-2.23Z"></path></svg>
                Continue with Twitter
              </Button>
            </div>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <Separator />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-muted-foreground">Or continue with email</span>
              </div>
            </div>

            {/* Email OTP Form */}
            {!showOtp ? (
              <form onSubmit={handleSendOtp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input 
                      id="email" 
                      type="email" 
                      placeholder="you@example.com" 
                      className="pl-9" 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full h-11" disabled={!email}>
                  Send Login Code
                </Button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-4 animate-in fade-in slide-in-from-right-4">
                 <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="otp">Enter code sent to {email}</Label>
                    <Button variant="link" size="sm" className="h-auto p-0 text-muted-foreground" onClick={() => setShowOtp(false)}>Change</Button>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input 
                      id="otp" 
                      type="text" 
                      placeholder="123456" 
                      className="pl-9 tracking-widest" 
                      maxLength={6}
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full h-11" disabled={otp.length < 6}>
                  Verify & Sign In <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <p className="text-xs text-center text-muted-foreground">
                  Didn't receive it? <span className="text-primary cursor-pointer hover:underline">Resend in 30s</span>
                </p>
              </form>
            )}
          </CardContent>
        </Card>
        
        <p className="text-center text-sm text-muted-foreground">
          By clicking continue, you agree to our <span className="underline cursor-pointer hover:text-foreground">Terms of Service</span> and <span className="underline cursor-pointer hover:text-foreground">Privacy Policy</span>.
        </p>
      </div>
    </div>
  );
}
