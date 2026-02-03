import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, Users, Truck, Loader2, ArrowUpCircle, Crown } from "lucide-react";
import { useQuota, getPlanDisplayName } from "@/hooks/useOrganization";
import { useUpgrade } from "@/hooks/useUpgrade";

interface QuotaUsageProps {
  onUpgrade?: () => void;
}

export function QuotaUsage({ onUpgrade }: QuotaUsageProps) {
  const { data: quota, isLoading } = useQuota();
  const { handleUpgrade, loading: upgradeLoading } = useUpgrade();
  
  // Use provided onUpgrade or default to handleUpgrade
  const upgradeHandler = onUpgrade || handleUpgrade;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8" data-testid="quota-loading">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!quota) {
    return null;
  }

  const getUsageColor = (used: number, limit: number) => {
    const percentage = (used / limit) * 100;
    if (percentage >= 90) return "text-red-600";
    if (percentage >= 70) return "text-amber-600";
    return "text-green-600";
  };

  const getProgressColor = (used: number, limit: number) => {
    const percentage = (used / limit) * 100;
    if (percentage >= 90) return "bg-red-500";
    if (percentage >= 70) return "bg-amber-500";
    return "bg-green-500";
  };

  const usageItems = [
    {
      label: "Depots",
      icon: Building2,
      used: quota.usage.depots.used,
      limit: quota.usage.depots.limit,
    },
    {
      label: "Crews",
      icon: Users,
      used: quota.usage.crews.used,
      limit: quota.usage.crews.limit,
    },
    {
      label: "Employees",
      icon: Users,
      used: quota.usage.employees.used,
      limit: quota.usage.employees.limit,
    },
    {
      label: "Vehicles",
      icon: Truck,
      used: quota.usage.vehicles.used,
      limit: quota.usage.vehicles.limit,
    },
  ];

  return (
    <Card data-testid="quota-usage-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-amber-500" />
              {getPlanDisplayName(quota.plan)} Plan
            </CardTitle>
            <CardDescription>
              {quota.requiresApproval ? "Bookings require approval" : "Bookings auto-approved"}
            </CardDescription>
          </div>
          {quota.plan === "starter" && (
            <Button 
              size="sm" 
              onClick={upgradeHandler} 
              disabled={upgradeLoading}
              data-testid="button-upgrade"
            >
              {upgradeLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  <ArrowUpCircle className="h-4 w-4 mr-2" />
                  Upgrade
                </>
              )}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {usageItems.map((item) => {
          const Icon = item.icon;
          const percentage = Math.round((item.used / item.limit) * 100);
          const isAtLimit = item.used >= item.limit;

          return (
            <div key={item.label} className="space-y-1" data-testid={`quota-${item.label.toLowerCase()}`}>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span>{item.label}</span>
                </div>
                <div className={`flex items-center gap-2 ${getUsageColor(item.used, item.limit)}`}>
                  <span className="font-medium">
                    {item.used} / {item.limit}
                  </span>
                  {isAtLimit && (
                    <Badge variant="destructive" className="text-xs">
                      Limit reached
                    </Badge>
                  )}
                </div>
              </div>
              <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${getProgressColor(item.used, item.limit)}`}
                  style={{ width: `${Math.min(percentage, 100)}%` }}
                />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
