import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { UserPlus, Trash2, Shield, ShieldCheck, User, Mail, Loader2, X, Copy, Check, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  useMembers,
  useInvites,
  useCreateInvite,
  useDeleteInvite,
  useResendInvite,
  useUpdateMemberRole,
  useRemoveMember,
  type MemberRole,
  type Member,
  type TeamInvite,
  getRoleDisplayName,
} from "@/hooks/useOrganization";

interface TeamManagementProps {
  currentUserRole: MemberRole;
  currentUserId: string;
}

export function TeamManagement({ currentUserRole, currentUserId }: TeamManagementProps) {
  const { toast } = useToast();
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<MemberRole>("user");
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const { data: members = [], isLoading: membersLoading } = useMembers();
  const { data: invites = [], isLoading: invitesLoading } = useInvites();
  const createInviteMutation = useCreateInvite();
  const deleteInviteMutation = useDeleteInvite();
  const resendInviteMutation = useResendInvite();
  const updateRoleMutation = useUpdateMemberRole();
  const removeMemberMutation = useRemoveMember();

  const isAdmin = currentUserRole === "admin";

  const handleCreateInvite = async () => {
    if (!inviteEmail.trim()) {
      toast({ title: "Error", description: "Please enter an email address", variant: "destructive" });
      return;
    }

    try {
      await createInviteMutation.mutateAsync({ email: inviteEmail.trim(), role: inviteRole });
      toast({ title: "Invite sent", description: `Invitation sent to ${inviteEmail}` });
      setInviteDialogOpen(false);
      setInviteEmail("");
      setInviteRole("user");
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to create invite", variant: "destructive" });
    }
  };

  const handleDeleteInvite = async (invite: TeamInvite) => {
    try {
      await deleteInviteMutation.mutateAsync(invite.id);
      toast({ title: "Invite cancelled", description: `Invitation to ${invite.email} has been cancelled` });
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to cancel invite", variant: "destructive" });
    }
  };

  const handleResendInvite = async (invite: TeamInvite) => {
    try {
      const updatedInvite = await resendInviteMutation.mutateAsync(invite.id);
      copyInviteLink(updatedInvite.token);
      toast({ title: "Invite resent", description: `New invite link generated for ${invite.email} and copied to clipboard` });
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to resend invite", variant: "destructive" });
    }
  };

  const handleUpdateRole = async (member: Member, newRole: MemberRole) => {
    try {
      await updateRoleMutation.mutateAsync({ id: member.id, role: newRole });
      toast({ title: "Role updated", description: `${member.username}'s role has been changed to ${getRoleDisplayName(newRole)}` });
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to update role", variant: "destructive" });
    }
  };

  const handleRemoveMember = async (member: Member) => {
    try {
      await removeMemberMutation.mutateAsync(member.id);
      toast({ title: "Member removed", description: `${member.username} has been removed from the team` });
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to remove member", variant: "destructive" });
    }
  };

  const copyInviteLink = (token: string) => {
    const inviteUrl = `${window.location.origin}/invite/${token}`;
    navigator.clipboard.writeText(inviteUrl);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
    toast({ title: "Link copied", description: "Invite link copied to clipboard" });
  };

  const getRoleBadgeColor = (role: MemberRole) => {
    switch (role) {
      case "admin":
        return "bg-red-100 text-red-700 border-red-200";
      case "operations":
        return "bg-blue-100 text-blue-700 border-blue-200";
      case "user":
        return "bg-green-100 text-green-700 border-green-200";
      default:
        return "bg-gray-100 text-gray-700 border-gray-200";
    }
  };

  const getRoleIcon = (role: MemberRole) => {
    switch (role) {
      case "admin":
        return <Shield className="h-3 w-3" />;
      case "operations":
        return <ShieldCheck className="h-3 w-3" />;
      default:
        return <User className="h-3 w-3" />;
    }
  };

  if (membersLoading || invitesLoading) {
    return (
      <div className="flex items-center justify-center p-8" data-testid="team-loading">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="team-management">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold" data-testid="text-team-title">Team Members</h2>
          <p className="text-muted-foreground">Manage who has access to your organization</p>
        </div>
        {isAdmin && (
          <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-invite-member">
                <UserPlus className="h-4 w-4 mr-2" />
                Invite Member
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invite Team Member</DialogTitle>
                <DialogDescription>
                  Send an invitation to join your organization. They'll receive a link to sign up.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="invite-email">Email address</Label>
                  <Input
                    id="invite-email"
                    type="email"
                    placeholder="colleague@example.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    data-testid="input-invite-email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invite-role">Role</Label>
                  <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as MemberRole)}>
                    <SelectTrigger id="invite-role" data-testid="select-invite-role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                      <SelectItem value="admin">Admin - Full access to all features</SelectItem>
                      <SelectItem value="operations">Operations Manager - Manage schedules and approve bookings</SelectItem>
                      <SelectItem value="user">Booker - Create booking requests</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>Cancel</Button>
                <Button
                  onClick={handleCreateInvite}
                  disabled={createInviteMutation.isPending}
                  data-testid="button-send-invite"
                >
                  {createInviteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Send Invite
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Members ({members.length})</CardTitle>
          <CardDescription>People with access to this organization</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {members.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <User className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No team members yet</p>
                {isAdmin && (
                  <p className="text-sm mt-1">Click "Invite Member" to add someone to your team</p>
                )}
              </div>
            ) : (
              members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between p-3 rounded-lg border bg-card"
                data-testid={`member-row-${member.userId}`}
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                    <User className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <div className="font-medium flex items-center gap-2">
                      {member.username}
                      {member.userId === currentUserId && (
                        <Badge variant="outline" className="text-xs">You</Badge>
                      )}
                    </div>
                    {member.email && (
                      <div className="text-sm text-muted-foreground flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {member.email}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {isAdmin && member.userId !== currentUserId ? (
                    <>
                      <Select
                        value={member.role}
                        onValueChange={(v) => handleUpdateRole(member, v as MemberRole)}
                        disabled={updateRoleMutation.isPending}
                      >
                        <SelectTrigger className="w-[180px]" data-testid={`select-role-${member.userId}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-white">
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="operations">Operations Manager</SelectItem>
                          <SelectItem value="user">Booker</SelectItem>
                        </SelectContent>
                      </Select>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove team member?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to remove {member.username} from the organization?
                              They will lose access to all schedules and data.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleRemoveMember(member)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Remove
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </>
                  ) : (
                    <Badge className={`${getRoleBadgeColor(member.role)} flex items-center gap-1`}>
                      {getRoleIcon(member.role)}
                      {getRoleDisplayName(member.role)}
                    </Badge>
                  )}
                </div>
              </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {isAdmin && invites.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pending Invites ({invites.length})</CardTitle>
            <CardDescription>Invitations that haven't been accepted yet</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {invites.map((invite) => (
                <div
                  key={invite.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
                  data-testid={`invite-row-${invite.id}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                      <Mail className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <div className="font-medium">{invite.email}</div>
                      <div className="text-sm text-muted-foreground">
                        Invited as {getRoleDisplayName(invite.role)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyInviteLink(invite.token)}
                      data-testid={`button-copy-invite-${invite.id}`}
                    >
                      {copiedToken === invite.token ? (
                        <Check className="h-4 w-4 mr-1" />
                      ) : (
                        <Copy className="h-4 w-4 mr-1" />
                      )}
                      Copy Link
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleResendInvite(invite)}
                      disabled={resendInviteMutation.isPending}
                      data-testid={`button-resend-invite-${invite.id}`}
                    >
                      {resendInviteMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4 mr-1" />
                      )}
                      Resend
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteInvite(invite)}
                      disabled={deleteInviteMutation.isPending}
                      className="text-destructive hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
