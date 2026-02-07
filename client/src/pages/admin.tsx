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
} from "lucide-react";
import type { SiteSetting, Artist, Event } from "@shared/schema";

const FONT_OPTIONS = [
  "Inter", "Roboto", "Open Sans", "Montserrat", "Poppins",
  "Playfair Display", "Lora", "Merriweather", "Space Grotesk",
  "DM Sans", "Plus Jakarta Sans", "Outfit", "Oxanium",
  "Source Serif 4", "Libre Baskerville",
];

const SECTIONS = [
  { id: "global", label: "Global Branding", icon: Settings },
  { id: "style", label: "Style Guide", icon: Palette },
  { id: "login", label: "Login Page", icon: LogIn },
  { id: "landing", label: "Landing Page", icon: Home },
  { id: "artists", label: "Manage Artists", icon: Music },
  { id: "events", label: "Manage Events", icon: CalendarDays },
  { id: "artists_dir", label: "Artists Directory", icon: Users },
  { id: "events_page", label: "Events Page", icon: CalendarDays },
  { id: "ds", label: "DS Page", icon: LayoutGrid },
  { id: "navigation", label: "Navigation", icon: Navigation },
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

  const set = (field: string, value: string | boolean) => {
    setLocal((prev) => ({ ...prev, [field]: value }));
  };

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
        <div className="space-y-1">
          <Label className="text-xs">Name</Label>
          <Input value={merged.name} onChange={(e) => set("name", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Genre</Label>
          <Input value={merged.genre} onChange={(e) => set("genre", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Description</Label>
          <Textarea value={merged.description} onChange={(e) => set("description", e.target.value)} rows={3} className="resize-none" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Time Slot</Label>
          <Input value={merged.timeSlot || ""} onChange={(e) => set("timeSlot", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Email</Label>
          <Input value={merged.email || ""} onChange={(e) => set("email", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Phone</Label>
          <Input value={merged.phone || ""} onChange={(e) => set("phone", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Social Links</Label>
          <Input value={merged.socialLinks || ""} onChange={(e) => set("socialLinks", e.target.value)} />
        </div>
        <ImageUploadField
          label="Artist Image"
          value={merged.imageUrl}
          onChange={(v) => set("imageUrl", v)}
        />
        <ImageUploadField
          label="Promoter Image"
          value={merged.promoterImageUrl || ""}
          onChange={(v) => set("promoterImageUrl", v)}
        />
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

  const set = (field: string, value: string) => {
    setLocal((prev) => ({ ...prev, [field]: value }));
  };

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
        <div className="space-y-1">
          <Label className="text-xs">Name</Label>
          <Input value={merged.name} onChange={(e) => set("name", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Description</Label>
          <Textarea value={merged.description || ""} onChange={(e) => set("description", e.target.value)} rows={3} className="resize-none" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Date</Label>
          <Input value={merged.date || ""} onChange={(e) => set("date", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Venue</Label>
          <Input value={merged.venue || ""} onChange={(e) => set("venue", e.target.value)} />
        </div>
        <ImageUploadField
          label="Event Image"
          value={merged.imageUrl || ""}
          onChange={(v) => set("imageUrl", v)}
        />
      </div>
    </Card>
  );
}

export default function AdminPage() {
  const { toast } = useToast();
  const [step, setStep] = useState(0);
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
        name: "New Artist",
        genre: "Genre",
        description: "Description goes here.",
        imageUrl: "",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/artists"] });
      toast({ title: "Added", description: "New artist created." });
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
        name: "New Event",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      toast({ title: "Added", description: "New event created." });
    },
  });

  const setLocal = (key: string, val: string) => {
    setLocalValues((prev) => ({ ...prev, [key]: val }));
  };

  const currentSection = SECTIONS[step];

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

  if (loadingSettings) {
    return (
      <div className="min-h-screen bg-background p-4 max-w-lg mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-50 border-b bg-background px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center justify-between gap-2">
          <h1 className="text-sm font-semibold">Admin Dashboard</h1>
          <span className="text-xs text-muted-foreground">
            {step + 1} / {SECTIONS.length}
          </span>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-2">
        <div className="flex flex-wrap gap-1 py-2 border-b mb-4">
          {SECTIONS.map((s, i) => {
            const Icon = s.icon;
            return (
              <button
                key={s.id}
                onClick={() => setStep(i)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs transition-colors ${
                  i === step ? "bg-foreground text-background font-medium" : "text-muted-foreground"
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
          ) : (
            <>
              <SettingsSection
                settings={sectionSettings}
                localValues={localValues}
                setLocal={setLocal}
              />
              {sectionSettings.length > 0 && (
                <Button
                  className="w-full mt-6"
                  onClick={handleSaveSettings}
                  disabled={saveMutation.isPending || !hasChanges}
                  data-testid="button-save-settings"
                >
                  {saveMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              )}
              {sectionSettings.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No settings for this section yet.
                </p>
              )}
            </>
          )}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 border-t bg-background z-50">
        <div className="max-w-lg mx-auto flex items-center justify-between px-4 py-3">
          <Button
            variant="outline"
            onClick={() => setStep(Math.max(0, step - 1))}
            disabled={step === 0}
            data-testid="button-prev-section"
          >
            <ChevronLeft className="w-4 h-4 mr-1" /> Previous
          </Button>
          <Button
            onClick={() => setStep(Math.min(SECTIONS.length - 1, step + 1))}
            disabled={step === SECTIONS.length - 1}
            data-testid="button-next-section"
          >
            Next <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}
