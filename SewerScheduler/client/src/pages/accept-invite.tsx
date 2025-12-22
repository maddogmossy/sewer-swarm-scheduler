import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle, AlertCircle, Users, Building2 } from "lucide-react";

interface InviteInfo {
  email: string;
  role: string;
  organizationName: string;
  invitedBy: string;
  expiresAt: string;
  userExists?: boolean;
}

export default function AcceptInvitePage() {
  const [, setLocation] = useLocation();
  const params = useParams<{ token: string }>();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [existingPassword, setExistingPassword] = useState("");
  const [success, setSuccess] = useState(false);

  const token = params.token;

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
    
    // For new users, validate password
    if (!inviteInfo?.userExists) {
      if (password !== confirmPassword) {
        toast({
          title: "Passwords don't match",
          description: "Please make sure your passwords match",
          variant: "destructive",
        });
        return;
      }

      if (password.length < 6) {
        toast({
          title: "Password too short",
          description: "Password must be at least 6 characters",
          variant: "destructive",
        });
        return;
      }
    } else {
      // For existing users, validate they entered their password
      if (!existingPassword) {
        toast({
          title: "Password required",
          description: "Please enter your password to join",
          variant: "destructive",
        });
        return;
      }
    }

    setSubmitting(true);

    try {
      // For existing users, first login then accept
      if (inviteInfo?.userExists) {
        // Login first
        const loginResponse = await fetch("/api/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: inviteInfo.email,
            password: existingPassword,
          }),
        });

        if (!loginResponse.ok) {
          const data = await loginResponse.json();
          throw new Error(data.error || "Invalid password");
        }
      }

      const response = await fetch("/api/invites/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          username: inviteInfo?.email,
          password: inviteInfo?.userExists ? existingPassword : password,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to accept invite");
      }

      setSuccess(true);
      toast({
        title: "Welcome to the team!",
        description: `You've joined ${inviteInfo?.organizationName}`,
      });

      setTimeout(() => {
        setLocation("/schedule");
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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-4" />
            <p className="text-slate-600">Loading invite details...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
            <h2 className="text-xl font-semibold text-slate-900 mb-2">Invalid Invite</h2>
            <p className="text-slate-600 text-center mb-6">{error}</p>
            <Button onClick={() => setLocation("/")} data-testid="button-go-home">
              Go to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
            <h2 className="text-xl font-semibold text-slate-900 mb-2">Welcome to the team!</h2>
            <p className="text-slate-600 text-center">Redirecting you to the schedule...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-blue-100 rounded-full">
              <Users className="h-8 w-8 text-blue-600" />
            </div>
          </div>
          <CardTitle className="text-2xl">You're Invited!</CardTitle>
          <CardDescription>
            Join your team on Sewer Swarm
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="bg-slate-50 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-3">
              <Building2 className="h-5 w-5 text-slate-500" />
              <div>
                <p className="text-sm text-slate-500">Organization</p>
                <p className="font-medium text-slate-900" data-testid="text-org-name">{inviteInfo?.organizationName}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-slate-500" />
              <div>
                <p className="text-sm text-slate-500">Your Role</p>
                <p className="font-medium text-slate-900" data-testid="text-role">{getRoleLabel(inviteInfo?.role || "")}</p>
              </div>
            </div>
            <p className="text-sm text-slate-500">
              Invited by <span className="font-medium text-slate-700">{inviteInfo?.invitedBy}</span>
            </p>
          </div>

          <form onSubmit={handleAccept} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={inviteInfo?.email || ""}
                disabled
                className="bg-slate-50"
                data-testid="input-email"
              />
            </div>

            {inviteInfo?.userExists ? (
              <>
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-sm text-blue-700">
                  You already have an account. Enter your password to join this organization.
                </div>
                <div className="space-y-2">
                  <Label htmlFor="existingPassword">Your Password</Label>
                  <Input
                    id="existingPassword"
                    type="password"
                    value={existingPassword}
                    onChange={(e) => setExistingPassword(e.target.value)}
                    placeholder="Enter your existing password"
                    required
                    data-testid="input-existing-password"
                  />
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="password">Create Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Choose a secure password"
                    required
                    minLength={6}
                    data-testid="input-password"
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
                    data-testid="input-confirm-password"
                  />
                </div>
              </>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={submitting}
              data-testid="button-accept-invite"
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Joining...
                </>
              ) : (
                inviteInfo?.userExists ? "Join Team" : "Accept Invite & Join Team"
              )}
            </Button>
          </form>
        </CardContent>

        <CardFooter className="justify-center">
          <p className="text-sm text-slate-500">
            Already have an account?{" "}
            <button
              onClick={() => setLocation("/")}
              className="text-blue-600 hover:underline"
              data-testid="link-login"
            >
              Sign in instead
            </button>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
