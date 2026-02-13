import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
      toast({ 
        title: "Invite sent", 
        description: `Invitation email sent to ${inviteEmail}. They can also use the invite link if needed.` 
      });
      setInviteDialogOpen(false);
      setInviteEmail("");
      setInviteRole("user");
    } catch (error: any) {
      // Check if it's a quota error
      if (error.message?.includes("team member limit") || error.message?.includes("Team member limit")) {
        toast({ 
          title: "Team member limit reached", 
          description: error.message || "You've reached the maximum number of team members for your plan. Upgrade to Pro for unlimited members.",
          variant: "destructive" 
        });
      } else {
        toast({ 
          title: "Error", 
          description: error.message || "Failed to create invite", 
          variant: "destructive" 
        });
      }
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
        return "bg-red-600 text-white";
      case "operations":
        return "bg-blue-600 text-white";
      case "user":
        return "bg-green-600 text-white";
      default:
        return "bg-slate-600 text-white";
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
        <Loader2 className="h-8 w-8 animate-spin text-slate-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="team-management">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900" data-testid="text-team-title">Team Members</h2>
          <p className="text-slate-700 mt-1">Manage who has access to your organization</p>
        </div>
        {isAdmin && (
          <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-invite-member" className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm">
                <UserPlus className="h-4 w-4 mr-2" />
                Invite Member
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-white text-slate-900">
              <DialogHeader>
                <DialogTitle className="text-slate-900">Invite Team Member</DialogTitle>
                <DialogDescription className="text-slate-700">
                  Send an invitation to join your organization. They'll receive a link to sign up.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="invite-email" className="text-slate-900">Email address</Label>
                  <Input
                    id="invite-email"
                    type="email"
                    placeholder="colleague@example.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    data-testid="input-invite-email"
                    className="bg-white border-slate-300 text-slate-900 placeholder:text-slate-400"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invite-role" className="text-slate-900">Role</Label>
                  <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as MemberRole)}>
                    <SelectTrigger id="invite-role" data-testid="select-invite-role" className="bg-white border-slate-300 text-slate-900">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white text-slate-900">
                      <SelectItem value="admin" className="text-slate-900">Admin - Full access to all features</SelectItem>
                      <SelectItem value="operations" className="text-slate-900">Operations Manager - Manage schedules and approve bookings</SelectItem>
                      <SelectItem value="user" className="text-slate-900">Booker - Create booking requests</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setInviteDialogOpen(false)} className="border-slate-300 text-slate-700">Cancel</Button>
                <Button
                  onClick={handleCreateInvite}
                  disabled={createInviteMutation.isPending}
                  data-testid="button-send-invite"
                  className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                >
                  {createInviteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Send Invite
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Members ({members.length})</h3>
          <p className="text-sm text-slate-700 mt-1">People with access to this organization</p>
        </div>
        <div className="space-y-3">
          {members.length === 0 ? (
            <div className="text-center py-8 text-slate-600">
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
              className="flex items-center justify-between p-4 rounded-lg border border-slate-200 bg-white"
              data-testid={`member-row-${member.userId}`}
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200">
                  <User className="h-5 w-5 text-slate-600" />
                </div>
                <div>
                  <div className="font-medium text-slate-900 flex items-center gap-2">
                    {member.username}
                    {member.userId === currentUserId && (
                      <Badge className="bg-slate-900 text-white text-xs px-2 py-0.5 rounded-full border-0">You</Badge>
                    )}
                  </div>
                  {member.email && (
                    <div className="text-sm text-slate-700 flex items-center gap-1 mt-0.5">
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
                      <SelectTrigger className="w-[180px] bg-white border-slate-300 text-slate-900" data-testid={`select-role-${member.userId}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white text-slate-900">
                        <SelectItem value="admin" className="text-slate-900">Admin</SelectItem>
                        <SelectItem value="operations" className="text-slate-900">Operations Manager</SelectItem>
                        <SelectItem value="user" className="text-slate-900">Booker</SelectItem>
                      </SelectContent>
                    </Select>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-red-600 hover:text-red-700 hover:bg-red-50 border border-transparent">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="bg-white text-slate-900">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-slate-900">Remove team member?</AlertDialogTitle>
                          <AlertDialogDescription className="text-slate-700">
                            Are you sure you want to remove {member.username} from the organization?
                            They will lose access to all schedules and data.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="border-slate-300 text-slate-700">Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleRemoveMember(member)}
                            className="bg-red-600 text-white hover:bg-red-700"
                          >
                            Remove
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </>
                ) : (
                  <Badge className={`${getRoleBadgeColor(member.role)} flex items-center gap-1 border-0`}>
                    {getRoleIcon(member.role)}
                    {getRoleDisplayName(member.role)}
                  </Badge>
                )}
              </div>
            </div>
            ))
          )}
        </div>
      </div>

      {isAdmin && invites.length > 0 && (
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Pending Invites ({invites.length})</h3>
            <p className="text-sm text-slate-700 mt-1">Invitations that haven't been accepted yet</p>
          </div>
          <div className="space-y-3">
            {invites.map((invite) => (
              <div
                key={invite.id}
                className="flex items-center justify-between p-4 rounded-lg border border-slate-200 bg-slate-50"
                data-testid={`invite-row-${invite.id}`}
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200">
                    <Mail className="h-5 w-5 text-slate-600" />
                  </div>
                  <div>
                    <div className="font-medium text-slate-900">{invite.email}</div>
                    <div className="text-sm text-slate-700">
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
                    className="border-slate-300 text-slate-700 bg-white"
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
                    className="border-slate-300 text-slate-700 bg-white"
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
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 border border-transparent"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
