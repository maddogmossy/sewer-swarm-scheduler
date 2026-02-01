"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [company, setCompany] = useState("");
  const [selectedPlan, setSelectedPlan] = useState("starter");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Use email as username for now
      await api.register(email, password, email);
      
      toast({
        title: "Account created!",
        description: "Welcome to Sewer Swarm AI",
      });
      
      router.push("/schedule");
    } catch (err: any) {
      toast({
        title: "Registration failed",
        description: err.message || "Failed to create account",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-white">
      <Card className="w-full max-w-md shadow-xl border-slate-100">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Create Your Account</CardTitle>
          <CardDescription>Start your 1-month free trial — no credit card required.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="fullname">Full Name</Label>
                <Input
                  id="fullname"
                  placeholder="John Doe"
                  className="border-slate-200"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="company">Company</Label>
                <Input
                  id="company"
                  placeholder="Acme Civils"
                  className="border-slate-200"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="signup-email">Email</Label>
              <Input
                id="signup-email"
                type="email"
                placeholder="name@company.com"
                className="border-slate-200"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="signup-pass">Password</Label>
              <Input
                id="signup-pass"
                type="password"
                className="border-slate-200"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="plan">Select your plan</Label>
              <select
                id="plan"
                className="w-full h-10 px-3 py-2 rounded-md border border-slate-200 bg-white text-sm focus:ring-2 focus:ring-blue-600 focus:outline-none"
                value={selectedPlan}
                onChange={(e) => setSelectedPlan(e.target.value)}
              >
                <option value="starter">Starter Team (Free Trial)</option>
                <option value="professional">Professional (Free Trial)</option>
              </select>
            </div>
            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 h-11 text-base mt-2" disabled={loading}>
              {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating account...</> : "Start Free Trial"}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="justify-center border-t border-slate-50 pt-6 pb-6 flex-col gap-2">
          <p className="text-sm text-slate-500">
            Already have an account? <Link href="/login" className="text-blue-600 hover:underline font-medium">Sign In</Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}


