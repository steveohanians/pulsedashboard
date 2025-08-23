import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { User } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";
import { Activity, BarChart3, Brain, Target, Calendar } from "lucide-react";

// Extended User type to handle activity fields
interface UserWithActivity {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  lastLogin?: string | Date | null;
  createdAt?: string | Date | null;
  loginCount?: number;
  pageViews?: number;
  aiInsightsCount?: number;
  brandSovCount?: number;
}

interface UserActivityModalProps {
  user: UserWithActivity | null;
  isOpen: boolean;
  onClose: () => void;
}

export function UserActivityModal({ user, isOpen, onClose }: UserActivityModalProps) {
  if (!user) return null;

  const formatLastLogin = (lastLogin: string | Date | null) => {
    if (!lastLogin) return "Never";
    try {
      const date = typeof lastLogin === 'string' ? new Date(lastLogin) : lastLogin;
      return formatDistanceToNow(date, { addSuffix: true });
    } catch {
      return "Invalid date";
    }
  };

  const getActivityLevel = (count: number) => {
    if (count === 0) return { level: "None", color: "secondary" };
    if (count < 5) return { level: "Low", color: "default" };
    if (count < 20) return { level: "Medium", color: "default" };
    if (count < 50) return { level: "High", color: "default" };
    return { level: "Very High", color: "default" };
  };

  const totalActivity = (user.loginCount || 0) + 
                       (user.pageViews || 0) + 
                       (user.aiInsightsCount || 0) + 
                       (user.brandSovCount || 0);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            User Activity: {user.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* User Info Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">User Overview</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium">{user.email}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Role</p>
                <Badge variant="outline">{user.role}</Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <Badge variant={user.status === 'Active' ? 'default' : 'secondary'}>
                  {user.status}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Last Login</p>
                <p className="font-medium flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {formatLastLogin(user.lastLogin || null)}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Activity Metrics */}
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Total Logins</p>
                    <p className="text-2xl font-bold">{user.loginCount || 0}</p>
                  </div>

                </div>
                <Badge variant={getActivityLevel(user.loginCount || 0).color as any} className="mt-2">
                  {getActivityLevel(user.loginCount || 0).level} Activity
                </Badge>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Dashboard Views</p>
                    <p className="text-2xl font-bold">{user.pageViews || 0}</p>
                  </div>

                </div>
                <Badge variant={getActivityLevel(user.pageViews || 0).color as any} className="mt-2">
                  {getActivityLevel(user.pageViews || 0).level} Usage
                </Badge>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">AI Insights Generated</p>
                    <p className="text-2xl font-bold">{user.aiInsightsCount || 0}</p>
                  </div>

                </div>
                <Badge variant={getActivityLevel(user.aiInsightsCount || 0).color as any} className="mt-2">
                  {getActivityLevel(user.aiInsightsCount || 0).level} AI Usage
                </Badge>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">SoV Analyses</p>
                    <p className="text-2xl font-bold">{user.brandSovCount || 0}</p>
                  </div>

                </div>
                <Badge variant={getActivityLevel(user.brandSovCount || 0).color as any} className="mt-2">
                  {getActivityLevel(user.brandSovCount || 0).level} Analysis
                </Badge>
              </CardContent>
            </Card>
          </div>

          {/* Activity Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Activity Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Total Interactions</span>
                  <span className="font-semibold">{totalActivity}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Most Used Feature</span>
                  <span className="font-semibold">
                    {Math.max(
                      user.pageViews || 0,
                      user.aiInsightsCount || 0,
                      user.brandSovCount || 0,
                      user.loginCount || 0
                    ) === (user.pageViews || 0) && "Dashboard Views"}
                    {Math.max(
                      user.pageViews || 0,
                      user.aiInsightsCount || 0,
                      user.brandSovCount || 0,
                      user.loginCount || 0
                    ) === (user.aiInsightsCount || 0) && "AI Insights"}
                    {Math.max(
                      user.pageViews || 0,
                      user.aiInsightsCount || 0,
                      user.brandSovCount || 0,
                      user.loginCount || 0
                    ) === (user.brandSovCount || 0) && "SoV Analysis"}
                    {Math.max(
                      user.pageViews || 0,
                      user.aiInsightsCount || 0,
                      user.brandSovCount || 0,
                      user.loginCount || 0
                    ) === (user.loginCount || 0) && "Logins"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Account Age</span>
                  <span className="font-semibold">
                    {user.createdAt ? formatDistanceToNow(new Date(user.createdAt), { addSuffix: true }) : "Unknown"}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}