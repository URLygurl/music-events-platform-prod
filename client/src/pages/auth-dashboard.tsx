import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/app-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, ExternalLink, RefreshCw, ShieldCheck } from "lucide-react";

type Dashboard = {
  status: {
    enabled: boolean; configured: boolean; requested: boolean;
    emailLoginEnabled: boolean; resendConfigured: boolean;
    senderConfigured: boolean; domainVerified: boolean; reason: string;
  };
  counts: { users: number; activeSessions: number };
  users: { id: string; name: string; email: string; emailVerified: boolean; createdAt: string }[];
  sessions: { id: string; userId: string; createdAt: string; expiresAt: string }[];
};

export default function AuthDashboard() {
  const { isAdmin, isLoading } = useAuth();
  const { data, isLoading: loading, isError, refetch } = useQuery<Dashboard>({
    queryKey: ["/api/admin/auth-dashboard"], enabled: isAdmin, staleTime: 0,
  });
  if (isLoading) return <Skeleton className="h-40 max-w-lg mx-auto mt-12" />;
  if (!isAdmin) return (
    <div className="max-w-lg mx-auto p-6 space-y-4">
      <h1 className="text-lg font-semibold">Admin access required</h1>
      <p className="text-sm">Sign in with your existing admin account to manage authentication.</p>
      <Link href="/login"><Button>Go to login</Button></Link>
    </div>
  );
  const flags = data ? [
    ["Better Auth configuration", data.status.configured],
    ["Better Auth running", data.status.enabled],
    ["Resend API key configured", data.status.resendConfigured],
    ["Sender email configured", data.status.senderConfigured],
    ["Sender domain marked verified", data.status.domainVerified],
    ["Public email login enabled", data.status.emailLoginEnabled],
  ] as const : [];
  return (
    <AppLayout showTopRibbon={false}>
      <div className="max-w-lg mx-auto px-4 py-6 pb-24 space-y-5" data-testid="auth-dashboard">
        <div className="flex items-center justify-between gap-2">
          <Link href="/admin"><Button variant="outline" size="sm"><ArrowLeft className="w-4 h-4 mr-1" />Admin</Button></Link>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={loading}><RefreshCw className="w-4 h-4 mr-1" />Refresh</Button>
        </div>
        <h1 className="text-xl font-semibold flex items-center gap-2"><ShieldCheck className="w-5 h-5" />Authentication</h1>
        <p className="text-sm text-muted-foreground">Self-hosted Better Auth dashboard. Existing admin login remains active. Roles and permissions will be added later.</p>
        {loading ? <Skeleton className="h-40" /> : isError ? (
          <Card className="p-4">Could not load auth status. Please refresh.</Card>
        ) : data && (
          <>
            <Card className="p-4 space-y-3">
              <h2 className="font-semibold text-sm">Integration status</h2>
              <p className="text-sm" data-testid="auth-status">{data.status.reason}</p>
              {flags.map(([label, ready]) => (
                <div className="flex justify-between gap-3 text-xs" key={label}>
                  <span>{label}</span><span className={ready ? "text-green-700" : "text-muted-foreground"}>{ready ? "Ready" : "Not enabled"}</span>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">Configuration is server-side only. No secrets are displayed or stored in public site settings.</p>
            </Card>
            <div className="grid grid-cols-2 gap-3">
              <Card className="p-4"><p className="text-xs text-muted-foreground">Better Auth users</p><p className="text-2xl font-semibold">{data.counts.users}</p></Card>
              <Card className="p-4"><p className="text-xs text-muted-foreground">Active sessions</p><p className="text-2xl font-semibold">{data.counts.activeSessions}</p></Card>
            </div>
            <Card className="p-4 space-y-3">
              <h2 className="font-semibold text-sm">Recent users</h2>
              <p className="text-xs text-muted-foreground">Latest 50 Better Auth accounts only. Existing admin accounts are not migrated.</p>
              {data.users.length ? data.users.map((u) => (
                <div className="border-t pt-2 text-xs break-words" key={u.id}>
                  <p className="font-medium">{u.name || u.email}</p><p>{u.email}</p>
                  <p className="text-muted-foreground">{u.emailVerified ? "Email verified" : "Email unverified"} · {new Date(u.createdAt).toLocaleDateString()}</p>
                </div>
              )) : <p className="text-sm text-muted-foreground">No Better Auth accounts yet.</p>}
            </Card>
            <Card className="p-4 space-y-3">
              <h2 className="font-semibold text-sm">Active sessions</h2>
              {data.sessions.length ? data.sessions.map((s) => (
                <div className="border-t pt-2 text-xs break-words" key={s.id}>
                  <p>{data.users.find((u) => u.id === s.userId)?.email || s.userId}</p>
                  <p className="text-muted-foreground">Expires {new Date(s.expiresAt).toLocaleString()}</p>
                </div>
              )) : <p className="text-sm text-muted-foreground">No active Better Auth sessions.</p>}
              <p className="text-xs text-muted-foreground">Session tokens are never displayed. User/session changes are intentionally deferred.</p>
            </Card>
          </>
        )}
        <Card className="p-4 space-y-3">
          <h2 className="font-semibold text-sm">Resend email delivery</h2>
          <p className="text-xs text-muted-foreground">Resend hosts its own dashboard. Verify the sender domain there before enabling public magic links and codes.</p>
          <a href="https://resend.com/emails" target="_blank" rel="noopener noreferrer"><Button variant="outline" size="sm">Open Resend dashboard<ExternalLink className="w-4 h-4 ml-2" /></Button></a>
        </Card>
      </div>
    </AppLayout>
  );
}
