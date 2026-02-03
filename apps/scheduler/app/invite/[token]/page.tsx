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
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-slate-600">Loading invite...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-red-600">Invalid Invite</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push("/")} className="w-full">
              Go to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CheckCircle2 className="h-16 w-16 text-green-600 mx-auto mb-4" />
            <CardTitle>Success!</CardTitle>
            <CardDescription>
              You've successfully joined {inviteInfo?.organizationName}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-center text-slate-600 mb-4">
              Redirecting to your schedule...
            </p>
            <Loader2 className="h-6 w-6 animate-spin text-blue-600 mx-auto" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!inviteInfo) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Mail className="h-8 w-8 text-blue-600" />
          </div>
          <CardTitle>You've been invited!</CardTitle>
          <CardDescription>
            Join <strong>{inviteInfo.organizationName}</strong> as {getRoleLabel(inviteInfo.role)}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAccept} className="space-y-4">
            <div className="p-3 bg-slate-50 rounded-lg">
              <p className="text-sm text-slate-600 mb-1">Invited email:</p>
              <p className="font-medium text-slate-900">{inviteInfo.email}</p>
            </div>

            {inviteInfo.userExists ? (
              // Existing user - just need password
              <div className="space-y-4">
                <p className="text-sm text-slate-600">
                  You already have an account. Please enter your password to accept this invite.
                </p>
                <div className="space-y-2">
                  <Label htmlFor="existingPassword">Password</Label>
                  <Input
                    id="existingPassword"
                    type="password"
                    value={existingPassword}
                    onChange={(e) => setExistingPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                    className="bg-white"
                  />
                </div>
              </div>
            ) : (
              // New user - need username and password
              <div className="space-y-4">
                <p className="text-sm text-slate-600">
                  Create your account to join this organization.
                </p>
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Choose a username"
                    required
                    className="bg-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Create a password (min 6 characters)"
                    required
                    minLength={6}
                    className="bg-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm your password"
                    required
                    minLength={6}
                    className="bg-white"
                  />
                </div>
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
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
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    }>
      <AcceptInviteContent />
    </Suspense>
  );
}
