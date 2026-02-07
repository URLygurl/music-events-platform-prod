import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronLeft,
  Plus,
  Check,
  Trash2,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Music,
  Video,
  Brain,
  CreditCard,
  Heart,
  FileSpreadsheet,
  Mail,
  HardDrive,
  FileText,
  Send,
  X,
  ExternalLink,
  Eye,
  EyeOff,
} from "lucide-react";
import { SiYoutube, SiBandcamp } from "react-icons/si";
import { useSettings } from "@/hooks/use-settings";
import { useAuth } from "@/hooks/use-auth";
import type { SiteSetting, MediaItem } from "@shared/schema";
import { Link } from "wouter";

const INTEGRATION_GROUPS = [
  {
    id: "google",
    title: "Google Workspace",
    description: "Connect Google services to manage documents, spreadsheets, and email",
    items: [
      { key: "int_google_drive_enabled", icon: HardDrive, name: "Google Drive", desc: "Access and manage files from Google Drive" },
      { key: "int_google_sheets_enabled", icon: FileSpreadsheet, name: "Google Sheets", desc: "Read/write data from spreadsheets" },
      { key: "int_google_docs_enabled", icon: FileText, name: "Google Docs", desc: "Create and edit documents" },
      { key: "int_gmail_enabled", icon: Mail, name: "Gmail", desc: "Send notifications and emails" },
    ],
  },
  {
    id: "media",
    title: "Music & Video Platforms",
    description: "Connect music and video services for embedded playback",
    items: [
      { key: "int_youtube_enabled", icon: Video, name: "YouTube", desc: "Embed YouTube videos" },
      { key: "int_youtube_music_enabled", icon: Music, name: "YouTube Music", desc: "Stream music content" },
      { key: "int_bandcamp_enabled", icon: Music, name: "Bandcamp", desc: "Embed Bandcamp tracks and albums" },
      { key: "int_distrokid_enabled", icon: Music, name: "DistroKid", desc: "Link DistroKid releases" },
    ],
  },
  {
    id: "ai",
    title: "AI Assistant",
    description: "Add an AI chatbot powered by your own API key",
    items: [],
  },
  {
    id: "payments",
    title: "Payments & Donations",
    description: "Accept payments and donations from your audience",
    items: [],
  },
];

function IntegrationToggle({
  settingKey,
  label,
  icon: Icon,
  desc,
  localValues,
  setLocal,
}: {
  settingKey: string;
  label: string;
  icon: React.ElementType;
  desc: string;
  localValues: Record<string, string>;
  setLocal: (k: string, v: string) => void;
}) {
  const { get } = useSettings();
  const val = localValues[settingKey] ?? get(settingKey, "false");
  const isOn = val === "true";

  return (
    <div className="flex items-center justify-between gap-3 py-3 border-b last:border-b-0">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-md border flex items-center justify-center flex-shrink-0">
          <Icon className="w-4 h-4 text-muted-foreground" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-muted-foreground truncate">{desc}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <Badge variant={isOn ? "default" : "secondary"} className="text-xs">
          {isOn ? "On" : "Off"}
        </Badge>
        <Switch
          checked={isOn}
          onCheckedChange={(v) => setLocal(settingKey, v ? "true" : "false")}
          data-testid={`toggle-${settingKey}`}
        />
      </div>
    </div>
  );
}

function MediaManager() {
  const { toast } = useToast();
  const { data: mediaItems, isLoading } = useQuery<MediaItem[]>({
    queryKey: ["/api/media"],
  });

  const addMutation = useMutation({
    mutationFn: async (data: { title: string; embedUrl: string; type: string; artist?: string }) => {
      await apiRequest("POST", "/api/media", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/media"] });
      toast({ title: "Added", description: "Media item added." });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/media/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/media"] });
      toast({ title: "Deleted", description: "Media item removed." });
    },
  });

  const [newTitle, setNewTitle] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newType, setNewType] = useState("youtube");
  const [newArtist, setNewArtist] = useState("");

  const handleAdd = () => {
    if (!newTitle || !newUrl) return;
    addMutation.mutate({ title: newTitle, embedUrl: newUrl, type: newType, artist: newArtist || undefined });
    setNewTitle("");
    setNewUrl("");
    setNewArtist("");
  };

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-medium">Media Library</h4>
      <p className="text-xs text-muted-foreground">
        Add YouTube video URLs, Bandcamp embed links, or SoundCloud tracks. These will be playable inline on your site.
      </p>

      <Card className="p-4 space-y-3 overflow-visible">
        <div className="grid grid-cols-1 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Title</Label>
            <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Track or video name" data-testid="input-media-title" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Artist</Label>
            <Input value={newArtist} onChange={(e) => setNewArtist(e.target.value)} placeholder="Artist name (optional)" data-testid="input-media-artist" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Type</Label>
            <Select value={newType} onValueChange={setNewType}>
              <SelectTrigger data-testid="select-media-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="youtube">YouTube</SelectItem>
                <SelectItem value="bandcamp">Bandcamp</SelectItem>
                <SelectItem value="soundcloud">SoundCloud</SelectItem>
                <SelectItem value="audio">Audio File</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">URL / Embed Link</Label>
            <Input value={newUrl} onChange={(e) => setNewUrl(e.target.value)} placeholder="https://..." data-testid="input-media-url" />
          </div>
          <Button onClick={handleAdd} disabled={!newTitle || !newUrl || addMutation.isPending} data-testid="button-add-media">
            <Plus className="w-4 h-4 mr-1" /> Add Media
          </Button>
        </div>
      </Card>

      {isLoading ? (
        <Skeleton className="h-20 w-full" />
      ) : mediaItems?.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">No media items yet</p>
      ) : (
        <div className="space-y-2">
          {mediaItems?.map((item) => (
            <Card key={item.id} className="p-3 flex items-center justify-between gap-2 overflow-visible" data-testid={`media-item-${item.id}`}>
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-md border flex items-center justify-center flex-shrink-0">
                  {item.type === "youtube" ? <Video className="w-3.5 h-3.5" /> : <Music className="w-3.5 h-3.5" />}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{item.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{item.artist || item.type}</p>
                </div>
              </div>
              <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(item.id)} data-testid={`button-delete-media-${item.id}`}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function AISection({
  localValues,
  setLocal,
}: {
  localValues: Record<string, string>;
  setLocal: (k: string, v: string) => void;
}) {
  const { get } = useSettings();
  const [showKey, setShowKey] = useState(false);

  const enabled = (localValues["int_ai_enabled"] ?? get("int_ai_enabled", "false")) === "true";
  const provider = localValues["int_ai_provider"] ?? get("int_ai_provider", "openai");
  const apiKey = localValues["int_ai_api_key"] ?? get("int_ai_api_key", "");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5" />
          <span className="text-sm font-medium">AI Assistant</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={enabled ? "default" : "secondary"} className="text-xs">
            {enabled ? "Active" : "Inactive"}
          </Badge>
          <Switch
            checked={enabled}
            onCheckedChange={(v) => setLocal("int_ai_enabled", v ? "true" : "false")}
            data-testid="toggle-int_ai_enabled"
          />
        </div>
      </div>

      {enabled && (
        <Card className="p-4 space-y-3 overflow-visible">
          <p className="text-xs text-muted-foreground">
            Bring your own API key. The AI assistant will be available to users on the site.
          </p>
          <div className="space-y-1">
            <Label className="text-xs">Provider</Label>
            <Select value={provider} onValueChange={(v) => setLocal("int_ai_provider", v)}>
              <SelectTrigger data-testid="select-ai-provider">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="openai">OpenAI (GPT)</SelectItem>
                <SelectItem value="anthropic">Anthropic (Claude)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">API Key</Label>
            <div className="flex items-center gap-2">
              <Input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setLocal("int_ai_api_key", e.target.value)}
                placeholder={provider === "openai" ? "sk-..." : "sk-ant-..."}
                className="flex-1"
                data-testid="input-ai-api-key"
              />
              <Button size="icon" variant="ghost" onClick={() => setShowKey(!showKey)}>
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

function PaymentsSection({
  localValues,
  setLocal,
}: {
  localValues: Record<string, string>;
  setLocal: (k: string, v: string) => void;
}) {
  const { get } = useSettings();
  const [showKey, setShowKey] = useState(false);

  const stripeEnabled = (localValues["int_stripe_enabled"] ?? get("int_stripe_enabled", "false")) === "true";
  const stripeKey = localValues["int_stripe_key"] ?? get("int_stripe_key", "");
  const donationsEnabled = (localValues["int_donations_enabled"] ?? get("int_donations_enabled", "false")) === "true";
  const donationsTitle = localValues["int_donations_title"] ?? get("int_donations_title", "Support Our Mission");
  const donationsDesc = localValues["int_donations_description"] ?? get("int_donations_description", "Your support helps us keep the music alive.");
  const donationsAmounts = localValues["int_donations_amounts"] ?? get("int_donations_amounts", "5,10,25,50,100");

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            <span className="text-sm font-medium">Stripe Payments</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">Dormant</Badge>
            <Switch
              checked={stripeEnabled}
              onCheckedChange={(v) => setLocal("int_stripe_enabled", v ? "true" : "false")}
              data-testid="toggle-int_stripe_enabled"
            />
          </div>
        </div>
        {stripeEnabled && (
          <Card className="p-4 space-y-3 overflow-visible">
            <p className="text-xs text-muted-foreground">
              Stripe is currently in dormant mode. Configure your keys now and activate when ready.
            </p>
            <div className="space-y-1">
              <Label className="text-xs">Publishable Key</Label>
              <div className="flex items-center gap-2">
                <Input
                  type={showKey ? "text" : "password"}
                  value={stripeKey}
                  onChange={(e) => setLocal("int_stripe_key", e.target.value)}
                  placeholder="pk_..."
                  className="flex-1"
                  data-testid="input-stripe-key"
                />
                <Button size="icon" variant="ghost" onClick={() => setShowKey(!showKey)}>
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </Card>
        )}
      </div>

      <div className="border-t pt-4">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <Heart className="w-5 h-5" />
            <span className="text-sm font-medium">Donations</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={donationsEnabled ? "default" : "secondary"} className="text-xs">
              {donationsEnabled ? "Active" : "Off"}
            </Badge>
            <Switch
              checked={donationsEnabled}
              onCheckedChange={(v) => setLocal("int_donations_enabled", v ? "true" : "false")}
              data-testid="toggle-int_donations_enabled"
            />
          </div>
        </div>
        {donationsEnabled && (
          <Card className="p-4 space-y-3 overflow-visible">
            <p className="text-xs text-muted-foreground">
              Enable a donation page where supporters can contribute. Works without Stripe — donations are logged for manual processing.
            </p>
            <div className="space-y-1">
              <Label className="text-xs">Page Title</Label>
              <Input
                value={donationsTitle}
                onChange={(e) => setLocal("int_donations_title", e.target.value)}
                data-testid="input-donations-title"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Description</Label>
              <Textarea
                value={donationsDesc}
                onChange={(e) => setLocal("int_donations_description", e.target.value)}
                rows={2}
                className="resize-none"
                data-testid="input-donations-desc"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Suggested Amounts (comma-separated)</Label>
              <Input
                value={donationsAmounts}
                onChange={(e) => setLocal("int_donations_amounts", e.target.value)}
                placeholder="5,10,25,50,100"
                data-testid="input-donations-amounts"
              />
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

export default function IntegrationsPage() {
  const { toast } = useToast();
  const { user, isAdmin, isLoading: authLoading } = useAuth();
  const [localValues, setLocalValues] = useState<Record<string, string>>({});

  const { data: allSettings, isLoading } = useQuery<SiteSetting[]>({
    queryKey: ["/api/settings"],
  });

  const saveMutation = useMutation({
    mutationFn: async (settings: { key: string; value: string; type: string; section: string; label: string }[]) => {
      await apiRequest("PUT", "/api/settings", { settings });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({ title: "Saved", description: "Integration settings saved." });
      setLocalValues({});
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save.", variant: "destructive" });
    },
  });

  const setLocal = (key: string, val: string) => {
    setLocalValues((prev) => ({ ...prev, [key]: val }));
  };

  const handleSave = () => {
    const integrationSettings = allSettings?.filter((s) => s.section === "integrations" || s.section === "integrations_sheets") || [];
    const toSave = integrationSettings.map((s) => ({
      key: s.key,
      value: localValues[s.key] ?? s.value,
      type: s.type,
      section: s.section,
      label: s.label,
    }));
    const newKeys = Object.keys(localValues).filter((k) => !integrationSettings.find((s) => s.key === k));
    for (const k of newKeys) {
      const section = k.startsWith("google_sheet_") ? "integrations_sheets" : "integrations";
      toSave.push({ key: k, value: localValues[k], type: "text", section, label: k });
    }
    saveMutation.mutate(toSave);
  };

  const hasChanges = Object.keys(localValues).length > 0;

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background p-4 max-w-lg mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="p-6 max-w-sm w-full text-center space-y-4">
          <h2 className="text-lg font-semibold">Admin Access Required</h2>
          <p className="text-sm text-muted-foreground">
            {!user ? "Please log in with an admin account." : "You do not have admin access."}
          </p>
          {!user && (
            <Link href="/login">
              <Button data-testid="button-integrations-login">Log In</Button>
            </Link>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-50 border-b bg-background px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Link href="/admin">
              <Button size="icon" variant="ghost" data-testid="button-back-admin">
                <ChevronLeft className="w-4 h-4" />
              </Button>
            </Link>
            <h1 className="text-sm font-semibold">Integrations</h1>
          </div>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!hasChanges || saveMutation.isPending}
            data-testid="button-save-integrations"
          >
            <Check className="w-3 h-3 mr-1" />
            {saveMutation.isPending ? "Saving..." : "Save All"}
          </Button>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-8 pb-24">
        {INTEGRATION_GROUPS.map((group) => {
          if (group.id === "ai") {
            return (
              <section key={group.id}>
                <p className="text-xs text-muted-foreground mb-3">{group.description}</p>
                <AISection localValues={localValues} setLocal={setLocal} />
              </section>
            );
          }

          if (group.id === "payments") {
            return (
              <section key={group.id}>
                <p className="text-xs text-muted-foreground mb-3">{group.description}</p>
                <PaymentsSection localValues={localValues} setLocal={setLocal} />
              </section>
            );
          }

          return (
            <section key={group.id}>
              <h2 className="text-base font-semibold mb-1">{group.title}</h2>
              <p className="text-xs text-muted-foreground mb-3">{group.description}</p>
              <Card className="px-4 overflow-visible">
                {group.items.map((item) => (
                  <IntegrationToggle
                    key={item.key}
                    settingKey={item.key}
                    label={item.name}
                    icon={item.icon}
                    desc={item.desc}
                    localValues={localValues}
                    setLocal={setLocal}
                  />
                ))}
              </Card>
            </section>
          );
        })}

        <section>
          <h2 className="text-base font-semibold mb-1">Google Sheets Sync</h2>
          <p className="text-xs text-muted-foreground mb-3">
            Connect form submissions and donations to Google Sheets. Enter the Spreadsheet ID followed by a pipe and sheet name (e.g. <code className="text-xs">1BxiMVs0XRA5nFMdK...|Sheet1</code>).
          </p>
          <Card className="p-4 space-y-3 overflow-visible">
            <div className="space-y-1">
              <Label className="text-xs">Enquiries Sheet</Label>
              <Input
                value={localValues["google_sheet_enquiries"] ?? (allSettings?.find(s => s.key === "google_sheet_enquiries")?.value || "")}
                onChange={(e) => setLocal("google_sheet_enquiries", e.target.value)}
                placeholder="SpreadsheetID|SheetName"
                data-testid="input-sheet-enquiries"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Donations Sheet</Label>
              <Input
                value={localValues["google_sheet_donations"] ?? (allSettings?.find(s => s.key === "google_sheet_donations")?.value || "")}
                onChange={(e) => setLocal("google_sheet_donations", e.target.value)}
                placeholder="SpreadsheetID|SheetName"
                data-testid="input-sheet-donations"
              />
            </div>
          </Card>
        </section>

        <section>
          <h2 className="text-base font-semibold mb-1">Media Player</h2>
          <p className="text-xs text-muted-foreground mb-3">
            Manage your media library. Items added here can be played inline by visitors.
          </p>
          <MediaManager />
        </section>
      </div>
    </div>
  );
}
