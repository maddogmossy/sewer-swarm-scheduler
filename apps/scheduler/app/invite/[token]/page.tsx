"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mail, UserPlus, CheckCircle2 } from "lucide-react";

interface InviteInfo {
  email: string;
  role: string;
  organizationName: string;
  organizationId: string;
  userExists: boolean;
  expiresAt: string;
}

function AcceptInviteContent() {
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [username, setUsername] = useState("");
  const [existingPassword, setExistingPassword] = useState("");
  const [success, setSuccess] = useState(false);

  const token = params?.token as string;

  useEffect(() => {
    if (!token) {
      setError("No invite token provided");
      setLoading(false);
      return;
    }

    const fetchInviteInfo = async () => {
      try {
        const response = await fetch(`/api/invites/${token}`);
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Invalid invite");
        }
        const data = await response.json();
        setInviteInfo(data);
        // Pre-fill username with email if new user
        if (!data.userExists) {
          setUsername(data.email.split("@")[0]); // Use email prefix as default username
        }
      } catch (err: any) {
        setError(err.message || "Failed to load invite");
      } finally {
        setLoading(false);
      }
    };

    fetchInviteInfo();
  }, [token]);

  const handleAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!inviteInfo) return;

    // For new users, validate password
    if (!inviteInfo.userExists) {
      if (!password || password.length < 6) {
        toast({
          title: "Password required",
          description: "Password must be at least 6 characters long",
          variant: "destructive",
        });
        return;
      }

      if (password !== confirmPassword) {
        toast({
          title: "Passwords don't match",
          description: "Please make sure both passwords match",
          variant: "destructive",
        });
        return;
      }

      if (!username || username.trim().length === 0) {
        toast({
          title: "Username required",
          description: "Please enter a username",
          variant: "destructive",
        });
        return;
      }
    } else {
      // Existing user - need password
      if (!existingPassword) {
        toast({
          title: "Password required",
          description: "Please enter your password to accept this invite",
          variant: "destructive",
        });
        return;
      }
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/invites/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          password: inviteInfo.userExists ? existingPassword : password,
          username: inviteInfo.userExists ? undefined : username,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to accept invite");
      }

      setSuccess(true);
      toast({
        title: "Welcome to the team!",
        description: `You've successfully joined ${inviteInfo.organizationName}`,
      });

      // Redirect to schedule page after 2 seconds
      setTimeout(() => {
        router.push("/schedule");
      }, 2000);
    } catch (err: any) {
      toast({
        title: "Failed to accept invite",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "admin": return "Administrator";
      case "operations": return "Operations Manager";
      case "user": return "Booker";
      default: return role;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white font-sans text-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-slate-700 font-medium">Loading invite...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white font-sans text-slate-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-xl border-slate-100">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-red-600">Invalid Invite</CardTitle>
            <CardDescription className="text-slate-700">{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => router.push("/")} 
              className="w-full bg-blue-600 hover:bg-blue-700 h-11 text-base"
            >
              Go to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-white font-sans text-slate-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-xl border-slate-100">
          <CardHeader className="text-center space-y-1">
            <CheckCircle2 className="h-16 w-16 text-green-600 mx-auto mb-4" />
            <CardTitle className="text-2xl font-bold text-slate-900">Success!</CardTitle>
            <CardDescription className="text-slate-700">
              You've successfully joined {inviteInfo?.organizationName}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-center text-slate-700 mb-4 font-medium">
              Redirecting to your schedule...
            </p>
            <div className="flex justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!inviteInfo) {
    return null;
  }

  return (
    <div className="min-h-screen bg-white font-sans text-slate-900">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-sm shrink-0">
            <span className="text-white font-bold text-lg">≈</span>
          </div>
          <span className="text-xl font-bold text-blue-900 tracking-tight">Sewer Swarm AI</span>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex items-center justify-center px-6 py-12 min-h-[calc(100vh-80px)]">
        <Card className="w-full max-w-md shadow-xl border-slate-100">
          <CardHeader className="space-y-1">
            <div className="flex items-center justify-center mb-4">
              <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center shadow-lg">
                <Mail className="h-8 w-8 text-white" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold text-slate-900 text-center">You've been invited!</CardTitle>
            <CardDescription className="text-slate-700 text-center">
              Join <strong className="text-slate-900">{inviteInfo.organizationName}</strong> as {getRoleLabel(inviteInfo.role)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAccept} className="space-y-4">
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                <p className="text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">Invited Email</p>
                <p className="font-semibold text-slate-900 text-lg">{inviteInfo.email}</p>
              </div>

              {inviteInfo.userExists ? (
                // Existing user - just need password
                <div className="space-y-4">
                  <p className="text-sm text-slate-700 font-medium">
                    You already have an account. Please enter your password to accept this invite.
                  </p>
                  <div className="space-y-2">
                    <Label htmlFor="existingPassword" className="text-slate-900 font-medium">Password</Label>
                    <Input
                      id="existingPassword"
                      type="password"
                      value={existingPassword}
                      onChange={(e) => setExistingPassword(e.target.value)}
                      placeholder="Enter your password"
                      required
                      className="border-slate-200 text-slate-900 bg-white focus:ring-blue-600"
                    />
                  </div>
                </div>
              ) : (
                // New user - need username and password
                <div className="space-y-4">
                  <p className="text-sm text-slate-700 font-medium">
                    Create your account to join this organization.
                  </p>
                  <div className="space-y-2">
                    <Label htmlFor="username" className="text-slate-900 font-medium">Username</Label>
                    <Input
                      id="username"
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Choose a username"
                      required
                      className="border-slate-200 text-slate-900 bg-white focus:ring-blue-600"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-slate-900 font-medium">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Create a password (min 6 characters)"
                      required
                      minLength={6}
                      className="border-slate-200 text-slate-900 bg-white focus:ring-blue-600"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword" className="text-slate-900 font-medium">Confirm Password</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm your password"
                      required
                      minLength={6}
                      className="border-slate-200 text-slate-900 bg-white focus:ring-blue-600"
                    />
                  </div>
                </div>
              )}

              <Button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 h-11 text-base font-semibold"
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Accepting...
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Accept Invite
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-white font-sans text-slate-900 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    }>
      <AcceptInviteContent />
    </Suspense>
  );
}
