/**
 * HermesDashboard — /hermes
 *
 * Access model:
 *   - Superadmin (HERMES_SECRET token): full access — all tabs including Settings
 *   - Admin (session, hermes_admin_visible = true): read-only — Overview, Activity,
 *     Chat (if hermes_chat_visible), Squad (if hermes_squad_visible)
 *   - Everyone else: redirected to /
 *
 * The Squad tab is scaffolded for the future interactive agent display.
 * The agent registry (14 agents) lives in the server squad endpoint.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useHermesAuth } from "@/hooks/use-hermes-auth";
import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/app-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Terminal,
  Activity,
  MessageSquare,
  Users,
  Settings,
  Wifi,
  WifiOff,
  Loader2,
  Send,
  RefreshCw,
  LogOut,
  ChevronRight,
  Circle,
  Zap,
  Clock,
  Database,
  ShoppingBag,
  Music,
  CalendarDays,
  LayoutGrid,
  User,
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────────────

interface HermesStats {
  counts: {
    artists: number;
    events: number;
    dsClients: number;
    products: number;
    orders: number;
    users: number;
  };
  recentActivity: ActivityEntry[];
}

interface ActivityEntry {
  id: number;
  action: string;
  entityType: string;
  entityId?: number;
  details?: string;
  userId?: number;
  createdAt: string;
}

interface PingResult {
  status: "connected" | "error" | "unreachable" | "unconfigured";
  url?: string;
  message?: string;
  httpStatus?: number;
}

interface AgentEntry {
  id: string;
  name: string;
  alias: string;
  role: string;
  tier: string;
  symbol: string;
  color: string;
  status: "active" | "idle" | "offline";
  lastActivity: ActivityEntry | null;
  recentActions: ActivityEntry[];
  totalActions: number;
}

interface SquadData {
  agents: AgentEntry[];
  updatedAt: string;
}

interface HermesSettings {
  hermes_container_url: string;
  hermes_notifications_enabled: string;
  hermes_chat_enabled: string;
  hermes_admin_visible: string;
  hermes_squad_visible: string;
  hermes_chat_visible: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// ─── Tab IDs ───────────────────────────────────────────────────────────────

type TabId = "overview" | "activity" | "chat" | "squad" | "settings";

// ─── Tier colours (matching naked-staff palette) ───────────────────────────

const TIER_COLORS: Record<string, string> = {
  MASTER:   "#9a3412",
  CREATIVE: "#b45309",
  STUDIO:   "#166534",
  LIVE:     "#9a3412",
  BUSINESS: "#1e40af",
  CAMPAIGN: "#6b21a8",
  TRADES:   "#374151",
};

// ─── Helper: format relative time ─────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ─── Overview tab ──────────────────────────────────────────────────────────

function OverviewTab({
  stats,
  ping,
  onPing,
  pinging,
  authHeader,
}: {
  stats: HermesStats | undefined;
  ping: PingResult | undefined;
  onPing: () => void;
  pinging: boolean;
  authHeader: Record<string, string>;
}) {
  const statCards = stats
    ? [
        { label: "Artists", value: stats.counts.artists, icon: Music },
        { label: "Events", value: stats.counts.events, icon: CalendarDays },
        { label: "DS Clients", value: stats.counts.dsClients, icon: LayoutGrid },
        { label: "Products", value: stats.counts.products, icon: ShoppingBag },
        { label: "Orders", value: stats.counts.orders, icon: Database },
        { label: "Users", value: stats.counts.users, icon: User },
      ]
    : [];

  const pingStatusColor =
    ping?.status === "connected" ? "text-green-500" :
    ping?.status === "unconfigured" ? "text-muted-foreground" :
    "text-destructive";

  const pingStatusLabel =
    ping?.status === "connected" ? "Connected" :
    ping?.status === "unconfigured" ? "Not configured" :
    ping?.status === "unreachable" ? "Unreachable" :
    ping?.status === "error" ? `HTTP ${ping.httpStatus}` :
    "Unknown";

  return (
    <div className="space-y-6">
      {/* Container status */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {ping?.status === "connected" ? (
              <Wifi className="w-4 h-4 text-green-500" />
            ) : (
              <WifiOff className="w-4 h-4 text-muted-foreground" />
            )}
            <span className="text-sm font-medium">External Container</span>
          </div>
          <Button size="sm" variant="outline" onClick={onPing} disabled={pinging}>
            {pinging ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          </Button>
        </div>
        <div className={`text-sm font-mono ${pingStatusColor}`}>{pingStatusLabel}</div>
        {ping?.url && (
          <div className="text-xs text-muted-foreground mt-1 truncate">{ping.url}</div>
        )}
        {ping?.message && (
          <div className="text-xs text-muted-foreground mt-1">{ping.message}</div>
        )}
      </Card>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3">
        {stats
          ? statCards.map(({ label, value, icon: Icon }) => (
              <Card key={label} className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">{label}</span>
                </div>
                <div className="text-2xl font-semibold tabular-nums">{value}</div>
              </Card>
            ))
          : Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="p-4">
                <Skeleton className="h-4 w-16 mb-2" />
                <Skeleton className="h-8 w-12" />
              </Card>
            ))}
      </div>

      {/* Recent activity preview */}
      {stats?.recentActivity && stats.recentActivity.length > 0 && (
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">Recent Activity</span>
          </div>
          <div className="space-y-2">
            {stats.recentActivity.slice(0, 5).map((entry) => (
              <div key={entry.id} className="flex items-start gap-2 text-xs">
                <Circle className="w-1.5 h-1.5 mt-1.5 shrink-0 fill-muted-foreground text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <span className="font-medium">{entry.action}</span>
                  {entry.entityType && (
                    <span className="text-muted-foreground"> · {entry.entityType}</span>
                  )}
                </div>
                <span className="text-muted-foreground shrink-0">{relativeTime(entry.createdAt)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── Activity tab ──────────────────────────────────────────────────────────

function ActivityTab({
  authHeader,
}: {
  authHeader: Record<string, string>;
}) {
  const { data: logs, isLoading, refetch } = useQuery<ActivityEntry[]>({
    queryKey: ["/api/hermes/activity"],
    queryFn: async () => {
      const res = await fetch("/api/hermes/activity?limit=100", {
        credentials: "include",
        headers: authHeader,
      });
      if (!res.ok) throw new Error("Failed to load activity");
      return res.json();
    },
    staleTime: 10000,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {logs ? `${logs.length} entries` : "Loading..."}
        </span>
        <Button size="sm" variant="outline" onClick={() => refetch()}>
          <RefreshCw className="w-3 h-3 mr-1" />
          Refresh
        </Button>
      </div>

      <Card className="divide-y">
        {isLoading
          ? Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="p-3">
                <Skeleton className="h-4 w-full mb-1" />
                <Skeleton className="h-3 w-24" />
              </div>
            ))
          : logs?.map((entry) => (
              <div key={entry.id} className="p-3">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{entry.action}</div>
                    {entry.entityType && (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {entry.entityType}
                        {entry.entityId ? ` #${entry.entityId}` : ""}
                        {entry.details ? ` · ${entry.details}` : ""}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                    <Clock className="w-3 h-3" />
                    {relativeTime(entry.createdAt)}
                  </div>
                </div>
              </div>
            ))}
        {!isLoading && (!logs || logs.length === 0) && (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No activity recorded yet.
          </div>
        )}
      </Card>
    </div>
  );
}

// ─── Chat tab ──────────────────────────────────────────────────────────────

function ChatTab({
  authHeader,
}: {
  authHeader: Record<string, string>;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "◉ Hermes online. I'm your backend operations assistant — ask me about platform stats, settings, or anything system-related.",
    },
  ]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const chatMutation = useMutation({
    mutationFn: async (msgs: ChatMessage[]) => {
      const res = await fetch("/api/hermes/chat", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...authHeader },
        body: JSON.stringify({ messages: msgs }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Chat failed" }));
        throw new Error(err.message);
      }
      return res.json();
    },
    onSuccess: (data) => {
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
    },
    onError: (err: any) => {
      toast({ title: "Hermes error", description: err.message, variant: "destructive" });
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Error: ${err.message}` },
      ]);
    },
  });

  const handleSend = () => {
    if (!input.trim() || chatMutation.isPending) return;
    const userMsg: ChatMessage = { role: "user", content: input.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    chatMutation.mutate(newMessages);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-280px)] min-h-[400px]">
      {/* Messages */}
      <Card className="flex-1 overflow-hidden">
        <div ref={scrollRef} className="h-full overflow-y-auto p-4 space-y-3">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground font-mono text-xs"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {chatMutation.isPending && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-lg px-3 py-2">
                <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Input */}
      <div className="flex gap-2 mt-3">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask Hermes..."
          className="resize-none min-h-[44px] max-h-[120px] text-sm"
          rows={1}
        />
        <Button
          size="icon"
          onClick={handleSend}
          disabled={!input.trim() || chatMutation.isPending}
          className="shrink-0"
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>
      <p className="text-xs text-muted-foreground mt-1.5 text-center">
        Shift+Enter for new line · Enter to send
      </p>
    </div>
  );
}

// ─── Squad tab ─────────────────────────────────────────────────────────────

function SquadTab({
  authHeader,
}: {
  authHeader: Record<string, string>;
}) {
  const { data: squad, isLoading } = useQuery<SquadData>({
    queryKey: ["/api/hermes/squad"],
    queryFn: async () => {
      const res = await fetch("/api/hermes/squad", {
        credentials: "include",
        headers: authHeader,
      });
      if (!res.ok) throw new Error("Failed to load squad");
      return res.json();
    },
    staleTime: 30000,
  });

  const tierOrder = ["MASTER", "CREATIVE", "STUDIO", "LIVE", "BUSINESS", "CAMPAIGN", "TRADES"];

  const agentsByTier = squad?.agents.reduce<Record<string, AgentEntry[]>>((acc, agent) => {
    if (!acc[agent.tier]) acc[agent.tier] = [];
    acc[agent.tier].push(agent);
    return acc;
  }, {}) ?? {};

  return (
    <div className="space-y-6">
      {/* Future interactive display placeholder */}
      <Card className="p-4 border-dashed">
        <div className="flex items-center gap-2 mb-2">
          <Zap className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">Interactive Display</span>
          <Badge variant="outline" className="text-xs">Coming soon</Badge>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          The squad visualisation — agents as animated nodes, live connections, real-time
          activity — will be built here. The data layer is already wired.
        </p>
      </Card>

      {/* Agent roster */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i} className="p-4">
              <Skeleton className="h-5 w-32 mb-2" />
              <Skeleton className="h-3 w-48" />
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-5">
          {tierOrder.map((tier) => {
            const agents = agentsByTier[tier];
            if (!agents || agents.length === 0) return null;
            return (
              <div key={tier}>
                <div
                  className="text-xs font-mono tracking-widest uppercase px-2 py-1 rounded mb-2 inline-block text-white"
                  style={{ background: TIER_COLORS[tier] || "#57534e" }}
                >
                  {tier}
                </div>
                <div className="space-y-2">
                  {agents.map((agent) => (
                    <Card key={agent.id} className="p-3">
                      <div className="flex items-start gap-3">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0 mt-0.5"
                          style={{ background: agent.color + "20", border: `1.5px solid ${agent.color}` }}
                        >
                          {agent.symbol}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-semibold text-sm">{agent.name}</span>
                            <span className="text-xs text-muted-foreground italic">{agent.alias}</span>
                            <div className="ml-auto">
                              {agent.status === "active" ? (
                                <Badge className="text-xs bg-green-500/10 text-green-600 border-green-500/20">
                                  <Circle className="w-1.5 h-1.5 mr-1 fill-green-500" />
                                  Active
                                </Badge>
                              ) : agent.status === "idle" ? (
                                <Badge variant="outline" className="text-xs text-yellow-600 border-yellow-500/30">
                                  <Circle className="w-1.5 h-1.5 mr-1 fill-yellow-400" />
                                  Idle
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-xs text-muted-foreground">
                                  <Circle className="w-1.5 h-1.5 mr-1" />
                                  Offline
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">{agent.role}</div>
                          {agent.lastActivity && (
                            <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              Last: {agent.lastActivity.action} · {relativeTime(agent.lastActivity.createdAt)}
                            </div>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {squad && (
        <p className="text-xs text-center text-muted-foreground">
          {squad.agents.length} agents registered · Updated {relativeTime(squad.updatedAt)}
        </p>
      )}
    </div>
  );
}

// ─── Settings tab (superadmin only) ────────────────────────────────────────

function SettingsTab({
  authHeader,
}: {
  authHeader: Record<string, string>;
}) {
  const { toast } = useToast();
  const [local, setLocal] = useState<Partial<HermesSettings>>({});
  const [dirty, setDirty] = useState(false);

  const { data: settings, isLoading, refetch } = useQuery<HermesSettings>({
    queryKey: ["/api/hermes/settings"],
    queryFn: async () => {
      const res = await fetch("/api/hermes/settings", {
        credentials: "include",
        headers: authHeader,
      });
      if (!res.ok) throw new Error("Failed to load settings");
      return res.json();
    },
    staleTime: 30000,
  });

  useEffect(() => {
    if (settings && !dirty) {
      setLocal(settings);
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async (updates: Partial<HermesSettings>) => {
      const res = await fetch("/api/hermes/settings", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...authHeader },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error("Failed to save settings");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Settings saved" });
      setDirty(false);
      refetch();
    },
    onError: (err: any) => {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    },
  });

  const set = (key: keyof HermesSettings, value: string) => {
    setLocal((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const toggle = (key: keyof HermesSettings) => {
    const current = local[key] === "true";
    set(key, current ? "false" : "true");
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="p-4">
            <Skeleton className="h-4 w-32 mb-3" />
            <Skeleton className="h-10 w-full" />
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Container */}
      <Card className="p-4 space-y-3">
        <div className="text-sm font-medium">External Container</div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Container URL</Label>
          <Input
            value={local.hermes_container_url || ""}
            onChange={(e) => set("hermes_container_url", e.target.value)}
            placeholder="https://your-container.railway.app"
            className="font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">
            The external container's base URL. Hermes will ping{" "}
            <code className="font-mono bg-muted px-1 rounded">/health</code> to check connectivity.
          </p>
        </div>
      </Card>

      {/* Admin visibility toggles */}
      <Card className="p-4 space-y-4">
        <div className="text-sm font-medium">Admin Access</div>
        <p className="text-xs text-muted-foreground -mt-2">
          Control what admin (session) users can see. Superadmin always has full access.
        </p>

        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm">Show Hermes to admins</div>
            <div className="text-xs text-muted-foreground">Hermes link appears in admin nav</div>
          </div>
          <Switch
            checked={local.hermes_admin_visible === "true"}
            onCheckedChange={() => toggle("hermes_admin_visible")}
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm">Show Squad tab to admins</div>
            <div className="text-xs text-muted-foreground">Admins can view the agent roster</div>
          </div>
          <Switch
            checked={local.hermes_squad_visible === "true"}
            onCheckedChange={() => toggle("hermes_squad_visible")}
            disabled={local.hermes_admin_visible !== "true"}
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm">Show Chat tab to admins</div>
            <div className="text-xs text-muted-foreground">Admins can chat with Hermes AI</div>
          </div>
          <Switch
            checked={local.hermes_chat_visible !== "false"}
            onCheckedChange={() => toggle("hermes_chat_visible")}
            disabled={local.hermes_admin_visible !== "true"}
          />
        </div>
      </Card>

      {/* Feature toggles */}
      <Card className="p-4 space-y-4">
        <div className="text-sm font-medium">Features</div>

        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm">Notifications</div>
            <div className="text-xs text-muted-foreground">Enable Hermes notification system</div>
          </div>
          <Switch
            checked={local.hermes_notifications_enabled === "true"}
            onCheckedChange={() => toggle("hermes_notifications_enabled")}
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm">AI Chat</div>
            <div className="text-xs text-muted-foreground">Enable Hermes AI chat (requires AI API key)</div>
          </div>
          <Switch
            checked={local.hermes_chat_enabled !== "false"}
            onCheckedChange={() => toggle("hermes_chat_enabled")}
          />
        </div>
      </Card>

      {/* Save */}
      {dirty && (
        <Button
          className="w-full"
          onClick={() => saveMutation.mutate(local as HermesSettings)}
          disabled={saveMutation.isPending}
        >
          {saveMutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            "Save Settings"
          )}
        </Button>
      )}
    </div>
  );
}

// ─── Main dashboard ────────────────────────────────────────────────────────

export default function HermesDashboard() {
  const [, navigate] = useLocation();
  const { hermesIdentity, isSuperAdmin, isAdmin, loading, logout, authHeader } = useHermesAuth();
  const { isAdmin: isMainAdmin } = useAuth();
  // canQuery: true if either the hermes identity is confirmed OR the main session is admin
  const canQuery = isAdmin || isMainAdmin;
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const { toast } = useToast();

  // Redirect if no access
  useEffect(() => {
    if (!loading && !isAdmin) {
      navigate("/");
    }
  }, [loading, isAdmin]);

  // Visibility settings (for tab gating)
  const { data: visibility } = useQuery<{
    isSuperAdmin: boolean;
    adminVisible: boolean;
    squadVisible: boolean;
    chatVisible: boolean;
  }>({
    queryKey: ["/api/hermes/visibility"],
    enabled: isAdmin,
    staleTime: 30000,
  });

  // Stats — enabled as soon as either hermes identity or main admin session is confirmed
  const { data: stats, isError: statsError, refetch: refetchStats } = useQuery<HermesStats>({
    queryKey: ["/api/hermes/stats"],
    queryFn: async () => {
      const res = await fetch("/api/hermes/stats", {
        credentials: "include",
        headers: authHeader,
      });
      if (!res.ok) throw new Error("Failed to load stats");
      return res.json();
    },
    enabled: canQuery,
    staleTime: 30000,
    retry: 2,
  });

  // Ping
  const [ping, setPing] = useState<PingResult | undefined>();
  const [pinging, setPinging] = useState(false);
  const doPing = useCallback(async () => {
    setPinging(true);
    try {
      const res = await fetch("/api/hermes/ping", {
        credentials: "include",
        headers: authHeader,
      });
      const data = await res.json();
      setPing(data);
    } catch {
      setPing({ status: "unreachable" });
    } finally {
      setPinging(false);
    }
  }, [authHeader]);

  useEffect(() => {
    if (isAdmin) doPing();
  }, [isAdmin]);

  // Tab visibility
  const showSquad = isSuperAdmin || visibility?.squadVisible;
  const showChat = isSuperAdmin || visibility?.chatVisible;
  const showSettings = isSuperAdmin;

  type TabDef = { id: TabId; label: string; icon: React.ElementType; show: boolean };
  const allTabs: TabDef[] = [
    { id: "overview" as TabId, label: "Overview", icon: Terminal as React.ElementType, show: true },
    { id: "activity" as TabId, label: "Activity", icon: Activity as React.ElementType, show: true },
    { id: "chat" as TabId, label: "Chat", icon: MessageSquare as React.ElementType, show: !!showChat },
    { id: "squad" as TabId, label: "Squad", icon: Users as React.ElementType, show: !!showSquad },
    { id: "settings" as TabId, label: "Settings", icon: Settings as React.ElementType, show: !!showSettings },
  ];
  const tabs = allTabs.filter((t) => t.show);

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  if (!isAdmin) return null;

  return (
    <AppLayout>
      <div className="max-w-lg mx-auto px-4 py-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl border-2 border-foreground overflow-hidden flex items-center justify-center bg-background">
              <img src="/hermes-icon.png" alt="Hermes" className="w-9 h-9 object-contain" style={{ filter: 'invert(var(--hermes-icon-invert, 0))' }} />
            </div>
            <div>
              <h1 className="font-semibold text-base leading-tight">Hermes</h1>
              <div className="flex items-center gap-1.5 mt-0.5">
                {isSuperAdmin ? (
                  <Badge className="text-xs bg-amber-500/10 text-amber-700 border-amber-500/20">
                    Superadmin
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs">
                    Admin (read-only)
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground">
                  via {hermesIdentity?.via}
                </span>
              </div>
            </div>
          </div>
          {isSuperAdmin && (
            <Button
              size="sm"
              variant="ghost"
              className="text-muted-foreground"
              onClick={() => {
                logout();
                toast({ title: "Hermes disconnected" });
                navigate("/");
              }}
            >
              <LogOut className="w-4 h-4" />
            </Button>
          )}
        </div>

        {/* Tab nav */}
        <div className="flex gap-1 bg-muted rounded-lg p-1 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap flex-1 justify-center ${
                  activeTab === tab.id
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        {activeTab === "overview" && (
          <OverviewTab
            stats={stats}
            ping={ping}
            onPing={doPing}
            pinging={pinging}
            authHeader={authHeader}
          />
        )}
        {activeTab === "activity" && <ActivityTab authHeader={authHeader} />}
        {activeTab === "chat" && showChat && <ChatTab authHeader={authHeader} />}
        {activeTab === "squad" && showSquad && <SquadTab authHeader={authHeader} />}
        {activeTab === "settings" && showSettings && <SettingsTab authHeader={authHeader} />}
      </div>
    </AppLayout>
  );
}
