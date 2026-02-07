import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronLeft,
  ChevronRight,
  Upload,
  Download,
  FileSpreadsheet,
  Trash2,
  Plus,
  Check,
  Settings,
  Palette,
  Home,
  Music,
  CalendarDays,
  LayoutGrid,
  LogIn,
  Navigation,
  Users,
  X,
  Plug,
  Menu,
  Copy,
  Eye,
  EyeOff,
  Image,
  Share2,
  Sparkles,
  Type,
  Shield,
  ShieldCheck,
} from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import type { SiteSetting, Artist, Event, DsClient, User } from "@shared/schema";
import { ARTIST_FIELD_LABELS, EVENT_FIELD_LABELS, DS_CLIENT_FIELD_LABELS, DEFAULT_ARTIST_VISIBILITY, DEFAULT_EVENT_VISIBILITY, DEFAULT_DS_CLIENT_VISIBILITY, getVisibleFields } from "@shared/schema";

const FONT_OPTIONS = [
  "Inter", "Roboto", "Open Sans", "Montserrat", "Poppins",
  "Playfair Display", "Lora", "Merriweather", "Space Grotesk",
  "DM Sans", "Plus Jakarta Sans", "Outfit", "Oxanium",
  "Source Serif 4", "Libre Baskerville",
];

const SECTIONS = [
  { id: "global", label: "Global Branding", icon: Settings },
  { id: "style", label: "Style Guide", icon: Palette },
  { id: "wallpapers", label: "Wallpapers", icon: Image },
  { id: "social", label: "Social Media", icon: Share2 },
  { id: "animations", label: "Animations", icon: Sparkles },
  { id: "login", label: "Login Page", icon: LogIn },
  { id: "landing", label: "Landing Page", icon: Home },
  { id: "artists", label: "Manage Artists", icon: Music },
  { id: "events", label: "Manage Events", icon: CalendarDays },
  { id: "artists_dir", label: "Artists Directory", icon: Users },
  { id: "events_page", label: "Events Page", icon: CalendarDays },
  { id: "ds", label: "DS Page", icon: LayoutGrid },
  { id: "navigation", label: "Navigation", icon: Navigation },
  { id: "users", label: "User Roles", icon: ShieldCheck },
] as const;

function ImageUploadField({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (url: string) => void;
  label: string;
}) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");
      const { url } = await res.json();
      onChange(url);
      toast({ title: "Uploaded", description: `${label} uploaded successfully.` });
    } catch {
      toast({ title: "Error", description: "Upload failed.", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium">{label}</Label>
      {value ? (
        <div className="relative border rounded-md overflow-visible">
          <img src={value} alt={label} className="w-full h-32 object-cover rounded-md" />
          <Button
            size="icon"
            variant="outline"
            className="absolute top-2 right-2"
            onClick={() => onChange("")}
            data-testid={`button-remove-${label.toLowerCase().replace(/\s+/g, "-")}`}
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
      ) : (
        <label className="flex flex-col items-center justify-center h-24 border border-dashed rounded-md cursor-pointer hover-elevate">
          <Upload className="w-5 h-5 text-muted-foreground mb-1" />
          <span className="text-xs text-muted-foreground">
            {uploading ? "Uploading..." : "Click to upload"}
          </span>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleUpload}
            disabled={uploading}
            data-testid={`input-upload-${label.toLowerCase().replace(/\s+/g, "-")}`}
          />
        </label>
      )}
    </div>
  );
}

function ColorField({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium">{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value || "#000000"}
          onChange={(e) => onChange(e.target.value)}
          className="w-9 h-9 rounded-md border cursor-pointer"
          data-testid={`input-color-${label.toLowerCase().replace(/\s+/g, "-")}`}
        />
        <Input
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#000000"
          className="flex-1"
        />
      </div>
    </div>
  );
}

function FontField({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium">{label}</Label>
      <Select value={value || "Inter"} onValueChange={onChange}>
        <SelectTrigger data-testid={`select-font-${label.toLowerCase().replace(/\s+/g, "-")}`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {FONT_OPTIONS.map((f) => (
            <SelectItem key={f} value={f}>
              <span style={{ fontFamily: f }}>{f}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function SettingsSection({
  settings,
  localValues,
  setLocal,
}: {
  settings: SiteSetting[];
  localValues: Record<string, string>;
  setLocal: (key: string, val: string) => void;
}) {
  return (
    <div className="space-y-4">
      {settings.map((s) => {
        const val = localValues[s.key] ?? s.value;
        if (s.type === "image") {
          return <ImageUploadField key={s.key} label={s.label} value={val} onChange={(v) => setLocal(s.key, v)} />;
        }
        if (s.type === "color") {
          return <ColorField key={s.key} label={s.label} value={val} onChange={(v) => setLocal(s.key, v)} />;
        }
        if (s.type === "font") {
          return <FontField key={s.key} label={s.label} value={val} onChange={(v) => setLocal(s.key, v)} />;
        }
        if (s.type === "toggle") {
          return (
            <div key={s.key} className="flex items-center justify-between gap-2 py-1">
              <Label className="text-xs font-medium">{s.label}</Label>
              <Switch
                checked={val === "true"}
                onCheckedChange={(checked) => setLocal(s.key, checked ? "true" : "false")}
                data-testid={`switch-setting-${s.key}`}
              />
            </div>
          );
        }
        return (
          <div key={s.key} className="space-y-2">
            <Label className="text-xs font-medium">{s.label}</Label>
            <Input
              value={val}
              onChange={(e) => setLocal(s.key, e.target.value)}
              data-testid={`input-setting-${s.key}`}
            />
          </div>
        );
      })}
    </div>
  );
}

function FieldWithToggle({
  fieldKey,
  visible,
  onToggleVisible,
  children,
}: {
  fieldKey: string;
  visible: boolean;
  onToggleVisible: (key: string, val: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <div className={`relative ${!visible ? "opacity-40" : ""}`}>
      <div className="absolute top-0 right-0 z-10">
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6"
          onClick={() => onToggleVisible(fieldKey, !visible)}
          data-testid={`toggle-vis-${fieldKey}`}
        >
          {visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
        </Button>
      </div>
      {children}
    </div>
  );
}

function MembersTagInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (val: string) => void;
}) {
  const [inputVal, setInputVal] = useState("");
  const tags = value ? value.split(",").map((t) => t.trim()).filter(Boolean) : [];

  const addTag = () => {
    const trimmed = inputVal.trim();
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed].join(", "));
    }
    setInputVal("");
  };

  const removeTag = (tag: string) => {
    onChange(tags.filter((t) => t !== tag).join(", "));
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {tags.map((tag) => (
          <Badge key={tag} variant="secondary" className="text-xs gap-1">
            {tag}
            <button onClick={() => removeTag(tag)} className="ml-0.5">
              <X className="w-2.5 h-2.5" />
            </button>
          </Badge>
        ))}
      </div>
      <div className="flex gap-1">
        <Input
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
          placeholder="Add member..."
          className="flex-1"
          data-testid="input-add-member"
        />
        <Button size="sm" variant="outline" onClick={addTag} data-testid="button-add-member-tag">
          <Plus className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
}

function ArtistEditor({
  artist,
  onSave,
  onDelete,
  saving,
}: {
  artist: Artist;
  onSave: (id: number, data: Partial<Artist>) => void;
  onDelete: (id: number) => void;
  saving: boolean;
}) {
  const [local, setLocal] = useState<Partial<Artist>>({});
  const merged = { ...artist, ...local };
  const vis = getVisibleFields(merged.visibleFields as string, DEFAULT_ARTIST_VISIBILITY);

  const set = (field: string, value: string | boolean | null) => {
    setLocal((prev) => ({ ...prev, [field]: value }));
  };

  const setVis = (fieldKey: string, val: boolean) => {
    const newVis = { ...vis, [fieldKey]: val };
    set("visibleFields", JSON.stringify(newVis));
  };

  const imageFields: Array<{ key: keyof Artist; label: string }> = [
    { key: "imageUrl", label: "Image 1" },
    { key: "imageUrl2", label: "Image 2" },
  ];

  const textFields: Array<{ key: keyof Artist; label: string; multiline?: boolean }> = [
    { key: "name", label: "Band Name" },
    { key: "origin", label: "Origin" },
    { key: "bio", label: "Bio", multiline: true },
    { key: "genre", label: "Genre" },
    { key: "description", label: "Description", multiline: true },
    { key: "timeSlot", label: "Time Slot" },
    { key: "website", label: "Website" },
    { key: "phone", label: "Phone" },
    { key: "email", label: "Email" },
    { key: "socialLinks", label: "Social Links" },
    { key: "songLink1", label: "Song Link 1" },
    { key: "songLink2", label: "Song Link 2" },
    { key: "videoLink1", label: "Video Link 1" },
    { key: "videoLink2", label: "Video Link 2" },
    { key: "customLink1", label: "Custom Link 1" },
    { key: "customLink2", label: "Custom Link 2" },
    { key: "customLink3", label: "Custom Link 3" },
    { key: "customLink4", label: "Custom Link 4" },
    { key: "customLink5", label: "Custom Link 5" },
  ];

  return (
    <Card className="p-4 space-y-3 overflow-visible">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <h4 className="font-medium text-sm">{merged.name || "New Artist"}</h4>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            onClick={() => { onSave(artist.id, local); setLocal({}); }}
            disabled={saving || Object.keys(local).length === 0}
            data-testid={`button-save-artist-${artist.id}`}
          >
            <Check className="w-3 h-3 mr-1" /> Save
          </Button>
          <Button size="icon" variant="ghost" onClick={() => onDelete(artist.id)} data-testid={`button-delete-artist-${artist.id}`}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {imageFields.map((f) => (
          <FieldWithToggle key={f.key} fieldKey={f.key} visible={vis[f.key] !== false} onToggleVisible={setVis}>
            <ImageUploadField
              label={f.label}
              value={(merged[f.key] as string) || ""}
              onChange={(v) => set(f.key, v)}
            />
          </FieldWithToggle>
        ))}

        <FieldWithToggle fieldKey="members" visible={vis.members !== false} onToggleVisible={setVis}>
          <div className="space-y-1">
            <Label className="text-xs">Members</Label>
            <MembersTagInput
              value={(merged.members as string) || ""}
              onChange={(v) => set("members", v)}
            />
          </div>
        </FieldWithToggle>

        {textFields.map((f) => (
          <FieldWithToggle key={f.key} fieldKey={f.key} visible={vis[f.key] !== false} onToggleVisible={setVis}>
            <div className="space-y-1">
              <Label className="text-xs">{f.label}</Label>
              {f.multiline ? (
                <Textarea
                  value={(merged[f.key] as string) || ""}
                  onChange={(e) => set(f.key, e.target.value)}
                  rows={3}
                  className="resize-none"
                  data-testid={`input-artist-${f.key}-${artist.id}`}
                />
              ) : (
                <Input
                  value={(merged[f.key] as string) || ""}
                  onChange={(e) => set(f.key, e.target.value)}
                  data-testid={`input-artist-${f.key}-${artist.id}`}
                />
              )}
            </div>
          </FieldWithToggle>
        ))}

        <FieldWithToggle fieldKey="promoterImageUrl" visible={vis.promoterImageUrl !== false} onToggleVisible={setVis}>
          <ImageUploadField
            label="Promoter Image"
            value={(merged.promoterImageUrl as string) || ""}
            onChange={(v) => set("promoterImageUrl", v)}
          />
        </FieldWithToggle>

        <div className="flex items-center gap-2">
          <Switch
            checked={merged.featured ?? false}
            onCheckedChange={(v) => set("featured", v)}
            data-testid={`switch-featured-${artist.id}`}
          />
          <Label className="text-xs">Featured on Homepage</Label>
        </div>
      </div>
    </Card>
  );
}

function EventEditor({
  event,
  onSave,
  onDelete,
  saving,
}: {
  event: Event;
  onSave: (id: number, data: Partial<Event>) => void;
  onDelete: (id: number) => void;
  saving: boolean;
}) {
  const [local, setLocal] = useState<Partial<Event>>({});
  const merged = { ...event, ...local };
  const vis = getVisibleFields(merged.visibleFields as string, DEFAULT_EVENT_VISIBILITY);

  const set = (field: string, value: string) => {
    setLocal((prev) => ({ ...prev, [field]: value }));
  };

  const setVis = (fieldKey: string, val: boolean) => {
    const newVis = { ...vis, [fieldKey]: val };
    set("visibleFields", JSON.stringify(newVis));
  };

  const fields: Array<{ key: keyof Event; label: string; multiline?: boolean }> = [
    { key: "name", label: "Event Name" },
    { key: "description", label: "Description", multiline: true },
    { key: "date", label: "Start Date" },
    { key: "time", label: "Start Time" },
    { key: "endDate", label: "End Date" },
    { key: "endTime", label: "End Time" },
    { key: "venue", label: "Venue" },
    { key: "address", label: "Address" },
    { key: "googleMapsUrl", label: "Google Maps URL" },
    { key: "ticketUrl", label: "Ticket Link" },
  ];

  return (
    <Card className="p-4 space-y-3 overflow-visible">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <h4 className="font-medium text-sm">{merged.name || "New Event"}</h4>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            onClick={() => { onSave(event.id, local); setLocal({}); }}
            disabled={saving || Object.keys(local).length === 0}
            data-testid={`button-save-event-${event.id}`}
          >
            <Check className="w-3 h-3 mr-1" /> Save
          </Button>
          <Button size="icon" variant="ghost" onClick={() => onDelete(event.id)} data-testid={`button-delete-event-${event.id}`}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3">
        <FieldWithToggle fieldKey="imageUrl" visible={vis.imageUrl !== false} onToggleVisible={setVis}>
          <ImageUploadField
            label="Event Image"
            value={(merged.imageUrl as string) || ""}
            onChange={(v) => set("imageUrl", v)}
          />
        </FieldWithToggle>

        {fields.map((f) => (
          <FieldWithToggle key={f.key} fieldKey={f.key} visible={vis[f.key] !== false} onToggleVisible={setVis}>
            <div className="space-y-1">
              <Label className="text-xs">{f.label}</Label>
              {f.multiline ? (
                <Textarea
                  value={(merged[f.key] as string) || ""}
                  onChange={(e) => set(f.key, e.target.value)}
                  rows={3}
                  className="resize-none"
                  data-testid={`input-event-${f.key}-${event.id}`}
                />
              ) : (
                <Input
                  value={(merged[f.key] as string) || ""}
                  onChange={(e) => set(f.key, e.target.value)}
                  data-testid={`input-event-${f.key}-${event.id}`}
                />
              )}
            </div>
          </FieldWithToggle>
        ))}
      </div>
    </Card>
  );
}

function DsClientEditor({
  client,
  onSave,
  onDelete,
  saving,
}: {
  client: DsClient;
  onSave: (id: number, data: Partial<DsClient>) => void;
  onDelete: (id: number) => void;
  saving: boolean;
}) {
  const [local, setLocal] = useState<Partial<DsClient>>({});
  const merged = { ...client, ...local };
  const vis = getVisibleFields(merged.visibleFields as string, DEFAULT_DS_CLIENT_VISIBILITY);

  const set = (field: string, value: string | boolean | null) => {
    setLocal((prev) => ({ ...prev, [field]: value }));
  };

  const setVis = (fieldKey: string, val: boolean) => {
    const newVis = { ...vis, [fieldKey]: val };
    set("visibleFields", JSON.stringify(newVis));
  };

  const imageFields: Array<{ key: keyof DsClient; label: string }> = [
    { key: "imageUrl", label: "Image 1" },
    { key: "imageUrl2", label: "Image 2" },
  ];

  const textFields: Array<{ key: keyof DsClient; label: string; multiline?: boolean }> = [
    { key: "name", label: "Name" },
    { key: "origin", label: "Origin" },
    { key: "bio", label: "Bio", multiline: true },
    { key: "genre", label: "Genre" },
    { key: "description", label: "Description", multiline: true },
    { key: "timeSlot", label: "Time Slot" },
    { key: "website", label: "Website" },
    { key: "phone", label: "Phone" },
    { key: "email", label: "Email" },
    { key: "socialLinks", label: "Social Links" },
    { key: "songLink1", label: "Song Link 1" },
    { key: "songLink2", label: "Song Link 2" },
    { key: "videoLink1", label: "Video Link 1" },
    { key: "videoLink2", label: "Video Link 2" },
    { key: "customLink1", label: "Custom Link 1" },
    { key: "customLink2", label: "Custom Link 2" },
    { key: "customLink3", label: "Custom Link 3" },
    { key: "customLink4", label: "Custom Link 4" },
    { key: "customLink5", label: "Custom Link 5" },
  ];

  return (
    <Card className="p-4 space-y-3 overflow-visible">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <h4 className="font-medium text-sm">{merged.name || "New Client Profile"}</h4>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            onClick={() => { onSave(client.id, local); setLocal({}); }}
            disabled={saving || Object.keys(local).length === 0}
            data-testid={`button-save-ds-client-${client.id}`}
          >
            <Check className="w-3 h-3 mr-1" /> Save
          </Button>
          <Button size="icon" variant="ghost" onClick={() => onDelete(client.id)} data-testid={`button-delete-ds-client-${client.id}`}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {imageFields.map((f) => (
          <FieldWithToggle key={f.key} fieldKey={f.key} visible={vis[f.key] !== false} onToggleVisible={setVis}>
            <ImageUploadField
              label={f.label}
              value={(merged[f.key] as string) || ""}
              onChange={(v) => set(f.key, v)}
            />
          </FieldWithToggle>
        ))}

        <FieldWithToggle fieldKey="members" visible={vis.members !== false} onToggleVisible={setVis}>
          <div className="space-y-1">
            <Label className="text-xs">Members</Label>
            <MembersTagInput
              value={(merged.members as string) || ""}
              onChange={(v) => set("members", v)}
            />
          </div>
        </FieldWithToggle>

        {textFields.map((f) => (
          <FieldWithToggle key={f.key} fieldKey={f.key} visible={vis[f.key] !== false} onToggleVisible={setVis}>
            <div className="space-y-1">
              <Label className="text-xs">{f.label}</Label>
              {f.multiline ? (
                <Textarea
                  value={(merged[f.key] as string) || ""}
                  onChange={(e) => set(f.key, e.target.value)}
                  rows={3}
                  className="resize-none"
                  data-testid={`input-ds-client-${f.key}-${client.id}`}
                />
              ) : (
                <Input
                  value={(merged[f.key] as string) || ""}
                  onChange={(e) => set(f.key, e.target.value)}
                  data-testid={`input-ds-client-${f.key}-${client.id}`}
                />
              )}
            </div>
          </FieldWithToggle>
        ))}

        <FieldWithToggle fieldKey="promoterImageUrl" visible={vis.promoterImageUrl !== false} onToggleVisible={setVis}>
          <ImageUploadField
            label="Promoter Image"
            value={(merged.promoterImageUrl as string) || ""}
            onChange={(v) => set("promoterImageUrl", v)}
          />
        </FieldWithToggle>
      </div>
    </Card>
  );
}

function FontUploadSection({
  localValues,
  setLocal,
}: {
  localValues: Record<string, string>;
  setLocal: (key: string, val: string) => void;
}) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const fontUrl = localValues["custom_font_url"] || "";
  const fontName = localValues["custom_font_name"] || "";

  const handleFontUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload/font", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      setLocal("custom_font_url", data.url);
      const name = file.name.replace(/\.(ttf|otf|woff2?)/i, "");
      if (!fontName) setLocal("custom_font_name", name);
      toast({ title: "Font uploaded", description: `${file.name} ready to use.` });
    } catch {
      toast({ title: "Error", description: "Font upload failed.", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card className="p-4 mt-4 space-y-3 overflow-visible">
      <div className="flex items-center gap-2 mb-1">
        <Type className="w-4 h-4 text-muted-foreground" />
        <h3 className="text-sm font-medium">Custom Font Upload</h3>
      </div>
      <p className="text-xs text-muted-foreground">
        Upload a .ttf, .otf, .woff, or .woff2 font file. Set a name above, then upload here.
      </p>
      {fontUrl ? (
        <div className="flex items-center gap-2 text-sm">
          <Check className="w-4 h-4 text-muted-foreground" />
          <span className="truncate flex-1 text-xs">{fontUrl}</span>
          <Button size="icon" variant="ghost" onClick={() => { setLocal("custom_font_url", ""); setLocal("custom_font_name", ""); }}>
            <X className="w-3 h-3" />
          </Button>
        </div>
      ) : (
        <label className="flex flex-col items-center justify-center h-20 border border-dashed rounded-md cursor-pointer hover-elevate">
          <Upload className="w-5 h-5 text-muted-foreground mb-1" />
          <span className="text-xs text-muted-foreground">
            {uploading ? "Uploading..." : "Click to upload font file"}
          </span>
          <input
            type="file"
            accept=".ttf,.otf,.woff,.woff2"
            className="hidden"
            onChange={handleFontUpload}
            disabled={uploading}
            data-testid="input-upload-font"
          />
        </label>
      )}
    </Card>
  );
}

export default function AdminPage() {
  const { toast } = useToast();
  const { user, isAdmin, isSuperAdmin, isLoading: authLoading } = useAuth();
  const visibleSections = isSuperAdmin ? SECTIONS : SECTIONS.filter(s => s.id !== "users");
  const [step, setStep] = useState(0);
  const clampedStep = Math.min(step, visibleSections.length - 1);
  const [localValues, setLocalValues] = useState<Record<string, string>>({});

  const { data: allSettings, isLoading: loadingSettings } = useQuery<SiteSetting[]>({
    queryKey: ["/api/settings"],
  });

  const { data: artistsList, isLoading: loadingArtists } = useQuery<Artist[]>({
    queryKey: ["/api/artists"],
  });

  const { data: eventsList, isLoading: loadingEvents } = useQuery<Event[]>({
    queryKey: ["/api/events"],
  });

  const { data: dsClientsList, isLoading: loadingDsClients } = useQuery<DsClient[]>({
    queryKey: ["/api/ds-clients"],
  });

  const saveMutation = useMutation({
    mutationFn: async (settings: { key: string; value: string; type: string; section: string; label: string }[]) => {
      await apiRequest("PUT", "/api/settings", { settings });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({ title: "Saved", description: "Settings saved successfully." });
      setLocalValues({});
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save.", variant: "destructive" });
    },
  });

  const artistMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<Artist> }) => {
      await apiRequest("PATCH", `/api/artists/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/artists"] });
      toast({ title: "Saved", description: "Artist updated." });
    },
  });

  const deleteArtistMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/artists/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/artists"] });
      toast({ title: "Deleted", description: "Artist removed." });
    },
  });

  const addArtistMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/artists", {
        name: "",
        genre: "",
        description: "",
        imageUrl: "",
        visibleFields: JSON.stringify(DEFAULT_ARTIST_VISIBILITY),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/artists"] });
      toast({ title: "Added", description: "Empty artist block created." });
    },
  });

  const eventMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<Event> }) => {
      await apiRequest("PATCH", `/api/events/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      toast({ title: "Saved", description: "Event updated." });
    },
  });

  const deleteEventMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/events/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      toast({ title: "Deleted", description: "Event removed." });
    },
  });

  const addEventMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/events", {
        name: "",
        visibleFields: JSON.stringify(DEFAULT_EVENT_VISIBILITY),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      toast({ title: "Added", description: "Empty event block created." });
    },
  });

  const dsClientMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<DsClient> }) => {
      await apiRequest("PATCH", `/api/ds-clients/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ds-clients"] });
      toast({ title: "Saved", description: "Client profile updated." });
    },
  });

  const deleteDsClientMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/ds-clients/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ds-clients"] });
      toast({ title: "Deleted", description: "Client profile removed." });
    },
  });

  const addDsClientMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/ds-clients", {
        name: "",
        visibleFields: JSON.stringify(DEFAULT_DS_CLIENT_VISIBILITY),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ds-clients"] });
      toast({ title: "Added", description: "Empty client profile created." });
    },
  });

  const { data: usersList, isLoading: loadingUsers } = useQuery<User[]>({
    queryKey: ["/api/users"],
    enabled: isSuperAdmin,
  });

  const roleMutation = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: string }) => {
      await apiRequest("PATCH", `/api/users/${id}/role`, { role });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "Updated", description: "User role updated." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update role.", variant: "destructive" });
    },
  });

  const setLocal = (key: string, val: string) => {
    setLocalValues((prev) => ({ ...prev, [key]: val }));
  };

  const currentSection = visibleSections[clampedStep];

  const handleSaveSettings = () => {
    const sectionSettings = allSettings?.filter((s) => s.section === currentSection.id) || [];
    const toSave = sectionSettings.map((s) => ({
      key: s.key,
      value: localValues[s.key] ?? s.value,
      type: s.type,
      section: s.section,
      label: s.label,
    }));
    saveMutation.mutate(toSave);
  };

  const sectionSettings = allSettings?.filter((s) => s.section === currentSection.id) || [];
  const hasChanges = Object.keys(localValues).some((k) => sectionSettings.find((s) => s.key === k));

  if (authLoading || loadingSettings) {
    return (
      <div className="min-h-screen bg-background p-4 max-w-lg mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
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
              <Button data-testid="button-admin-login">Log In</Button>
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
          <h1 className="text-sm font-semibold">Admin Dashboard</h1>
          <div className="flex items-center gap-2">
            <Link href="/admin/integrations">
              <Button size="sm" variant="outline" data-testid="button-integrations">
                <Plug className="w-3.5 h-3.5 mr-1" /> Integrations
              </Button>
            </Link>
            <span className="text-xs text-muted-foreground">
              {clampedStep + 1} / {visibleSections.length}
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-2">
        <div className="flex flex-wrap gap-1 py-2 border-b mb-4">
          {visibleSections.map((s, i) => {
            const Icon = s.icon;
            return (
              <button
                key={s.id}
                onClick={() => setStep(i)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs transition-colors ${
                  i === clampedStep ? "bg-foreground text-background font-medium" : "text-muted-foreground"
                }`}
                data-testid={`tab-${s.id}`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{s.label}</span>
              </button>
            );
          })}
        </div>

        <div className="pb-24">
          <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
            {(() => { const Icon = currentSection.icon; return <Icon className="w-5 h-5" />; })()}
            {currentSection.label}
          </h2>
          <p className="text-xs text-muted-foreground mb-4">
            Edit the fields below. Changes are saved per section.
          </p>

          {currentSection.id === "artists" ? (
            <div className="space-y-4">
              <Card className="p-4 overflow-visible">
                <div className="flex items-center gap-2 mb-2">
                  <FileSpreadsheet className="w-4 h-4 text-muted-foreground" />
                  <h3 className="text-sm font-medium">Import / Export CSV</h3>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  Export your artist directory as a CSV file, or import artists from a Google Sheets CSV export.
                </p>
                <div className="flex flex-wrap gap-2">
                  <a href="/api/artists/export/csv" download>
                    <Button size="sm" variant="outline" data-testid="button-export-csv">
                      <Download className="w-3.5 h-3.5 mr-1" /> Export CSV
                    </Button>
                  </a>
                  <label>
                    <Button size="sm" variant="outline" asChild data-testid="button-import-csv">
                      <span>
                        <Upload className="w-3.5 h-3.5 mr-1" /> Import CSV
                      </span>
                    </Button>
                    <input
                      type="file"
                      accept=".csv"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const formData = new FormData();
                        formData.append("file", file);
                        try {
                          const res = await fetch("/api/artists/import/csv", { method: "POST", body: formData });
                          const data = await res.json();
                          if (res.ok) {
                            queryClient.invalidateQueries({ queryKey: ["/api/artists"] });
                            toast({ title: "Import Complete", description: data.message });
                          } else {
                            toast({ title: "Import Failed", description: data.message, variant: "destructive" });
                          }
                        } catch {
                          toast({ title: "Error", description: "Import failed.", variant: "destructive" });
                        }
                        e.target.value = "";
                      }}
                      data-testid="input-csv-file"
                    />
                  </label>
                </div>
              </Card>

              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Eye className="w-3 h-3" /> Use the eye icon on each field to control visibility on the public page
              </p>

              {loadingArtists ? (
                <Skeleton className="h-40 w-full" />
              ) : (
                artistsList?.map((artist) => (
                  <ArtistEditor
                    key={artist.id}
                    artist={artist}
                    onSave={(id, data) => artistMutation.mutate({ id, data })}
                    onDelete={(id) => deleteArtistMutation.mutate(id)}
                    saving={artistMutation.isPending}
                  />
                ))
              )}
              <Button
                variant="outline"
                className="w-full"
                onClick={() => addArtistMutation.mutate()}
                disabled={addArtistMutation.isPending}
                data-testid="button-add-artist"
              >
                <Plus className="w-4 h-4 mr-2" /> Add Artist
              </Button>
            </div>
          ) : currentSection.id === "events" ? (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Eye className="w-3 h-3" /> Use the eye icon on each field to control visibility on the public page
              </p>

              {loadingEvents ? (
                <Skeleton className="h-40 w-full" />
              ) : (
                eventsList?.map((event) => (
                  <EventEditor
                    key={event.id}
                    event={event}
                    onSave={(id, data) => eventMutation.mutate({ id, data })}
                    onDelete={(id) => deleteEventMutation.mutate(id)}
                    saving={eventMutation.isPending}
                  />
                ))
              )}
              <Button
                variant="outline"
                className="w-full"
                onClick={() => addEventMutation.mutate()}
                disabled={addEventMutation.isPending}
                data-testid="button-add-event"
              >
                <Plus className="w-4 h-4 mr-2" /> Add Event
              </Button>
            </div>
          ) : currentSection.id === "ds" ? (
            <div className="space-y-4">
              <SettingsSection
                settings={sectionSettings}
                localValues={localValues}
                setLocal={setLocal}
              />
              {sectionSettings.length > 0 && (
                <div className="pt-2">
                  <Button
                    onClick={handleSaveSettings}
                    disabled={saveMutation.isPending || !hasChanges}
                    className="w-full"
                    data-testid="button-save-ds-settings"
                  >
                    {saveMutation.isPending ? "Saving..." : "Save Page Settings"}
                  </Button>
                </div>
              )}

              <div className="border-t pt-4">
                <h3 className="text-sm font-semibold mb-2">Client Profiles</h3>
                <p className="text-xs text-muted-foreground flex items-center gap-1 mb-3">
                  <Eye className="w-3 h-3" /> Use the eye icon on each field to control visibility on the public page
                </p>
              </div>

              {loadingDsClients ? (
                <Skeleton className="h-40 w-full" />
              ) : (
                dsClientsList?.map((client) => (
                  <DsClientEditor
                    key={client.id}
                    client={client}
                    onSave={(id, data) => dsClientMutation.mutate({ id, data })}
                    onDelete={(id) => deleteDsClientMutation.mutate(id)}
                    saving={dsClientMutation.isPending}
                  />
                ))
              )}
              <Button
                variant="outline"
                className="w-full"
                onClick={() => addDsClientMutation.mutate()}
                disabled={addDsClientMutation.isPending}
                data-testid="button-add-ds-client"
              >
                <Plus className="w-4 h-4 mr-2" /> Add Client Profile
              </Button>
            </div>
          ) : currentSection.id === "users" && isSuperAdmin ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Manage who has admin access. Admins can edit content, manage artists, events, and all settings.
              </p>
              {loadingUsers ? (
                <Skeleton className="h-40 w-full" />
              ) : usersList && usersList.length > 0 ? (
                <div className="space-y-2">
                  {usersList.map((u) => (
                    <Card key={u.id} className="p-4 overflow-visible">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-3 min-w-0">
                          {u.profileImageUrl ? (
                            <img src={u.profileImageUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                              <Users className="w-4 h-4 text-muted-foreground" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate" data-testid={`text-user-name-${u.id}`}>
                              {u.firstName} {u.lastName}
                            </p>
                            <p className="text-xs text-muted-foreground truncate" data-testid={`text-user-email-${u.id}`}>
                              {u.email || "No email"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {u.role === "admin" ? (
                            <Badge variant="default" className="text-xs gap-1">
                              <ShieldCheck className="w-3 h-3" /> Admin
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs gap-1">
                              <Shield className="w-3 h-3" /> User
                            </Badge>
                          )}
                          {u.id !== user?.id && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => roleMutation.mutate({
                                id: u.id,
                                role: u.role === "admin" ? "user" : "admin",
                              })}
                              disabled={roleMutation.isPending}
                              data-testid={`button-toggle-role-${u.id}`}
                            >
                              {u.role === "admin" ? "Remove Admin" : "Make Admin"}
                            </Button>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card className="p-6 text-center overflow-visible">
                  <p className="text-sm text-muted-foreground">No users have logged in yet.</p>
                </Card>
              )}
            </div>
          ) : (
            <>
              <SettingsSection
                settings={sectionSettings}
                localValues={localValues}
                setLocal={setLocal}
              />
              {currentSection.id === "style" && (
                <FontUploadSection localValues={localValues} setLocal={setLocal} />
              )}
              {currentSection.id === "animations" && (
                <p className="text-xs text-muted-foreground mt-2">
                  Styles: fade-in, slide-up, slide-left, slide-right, zoom-in, bounce, pulse
                </p>
              )}
              {sectionSettings.length > 0 && (
                <div className="pt-4">
                  <Button
                    onClick={handleSaveSettings}
                    disabled={saveMutation.isPending || !hasChanges}
                    className="w-full"
                    data-testid="button-save-settings"
                  >
                    {saveMutation.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>

        <div className="fixed bottom-0 left-0 right-0 border-t bg-background px-4 py-3 z-50">
          <div className="max-w-lg mx-auto flex items-center justify-between gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setStep(Math.max(0, clampedStep - 1))}
              disabled={clampedStep === 0}
              data-testid="button-prev-section"
            >
              <ChevronLeft className="w-4 h-4 mr-1" /> Previous
            </Button>
            <span className="text-xs text-muted-foreground">{currentSection.label}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setStep(Math.min(visibleSections.length - 1, clampedStep + 1))}
              disabled={clampedStep === visibleSections.length - 1}
              data-testid="button-next-section"
            >
              Next <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
