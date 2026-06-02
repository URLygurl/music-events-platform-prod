import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/app-layout";
import { ImagePlaceholder } from "@/components/image-placeholder";
import { SmartImage } from "@/components/smart-image";
import { useSettings } from "@/hooks/use-settings";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ShareButton } from "@/components/share-button";
import { Mail, Phone, Globe, Music, Video, LinkIcon, Play, X, ChevronUp } from "lucide-react";
import type { DsClient } from "@shared/schema";
import { getVisibleFields, DEFAULT_DS_CLIENT_VISIBILITY } from "@shared/schema";
import { DSStreamingPlayer, SiteStreamingBanner } from "@/components/ds-streaming-player";

function getEmbedUrl(url: string): string | null {
  if (!url) return null;
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?/]+)/);
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=1`;
  if (url.includes("spotify.com")) {
    return url.replace("open.spotify.com/track", "open.spotify.com/embed/track")
              .replace("open.spotify.com/album", "open.spotify.com/embed/album");
  }
  if (url.includes("soundcloud.com")) {
    return `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&auto_play=true&color=%23000000`;
  }
  return null;
}

function ClientTile({ client, onSelect }: { client: DsClient; onSelect: (id: number) => void }) {
  const [playing, setPlaying] = useState(false);
  const vis = getVisibleFields(client.visibleFields, DEFAULT_DS_CLIENT_VISIBILITY);
  const focal = (vis["imageFocal"] as string | undefined) || "center";
  const videoUrl = client.videoLink1 || client.videoLink2 || "";
  const embedUrl = videoUrl ? getEmbedUrl(videoUrl) : null;
  const hasVideo = !!videoUrl;

  const handlePlay = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (embedUrl) setPlaying(true);
    else if (videoUrl) window.open(videoUrl, "_blank");
  };

  return (
    <>
      <div
        className="rounded-2xl border bg-background cursor-pointer group overflow-hidden"
        style={{ boxShadow: "0 4px 16px rgba(0,0,0,0.10)" }}
        onClick={() => onSelect(client.id)}
        data-testid={`card-ds-client-${client.id}`}
      >
        <div className="relative">
          {client.imageUrl ? (
            <SmartImage src={client.imageUrl} alt={client.name} className="w-full aspect-square" focal={focal} />
          ) : (
            <ImagePlaceholder label={client.name} className="w-full aspect-square" />
          )}
          {hasVideo && (
            <button
              className="absolute bottom-2 right-2 w-11 h-11 rounded-full border-2 bg-background/80 backdrop-blur-sm flex items-center justify-center shadow-md hover:bg-background transition-colors"
              onClick={handlePlay}
              data-testid={`button-play-ds-client-${client.id}`}
              title="Play video"
            >
              <Play className="w-5 h-5 fill-foreground" />
            </button>
          )}
        </div>
        <div className="p-3">
          <p className="text-sm font-medium truncate">{client.name}</p>
          {client.genre && <p className="text-xs text-muted-foreground truncate">{client.genre}</p>}
        </div>
      </div>

      {playing && embedUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setPlaying(false)}>
          <div className="relative w-full max-w-lg rounded-2xl overflow-hidden bg-black shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-2 bg-black/90">
              <div>
                <p className="text-sm font-medium text-white truncate">{client.name}</p>
                {client.genre && <p className="text-xs text-white/60 truncate">{client.genre}</p>}
              </div>
              <button className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors" onClick={() => setPlaying(false)}>
                <X className="w-4 h-4 text-white" />
              </button>
            </div>
            <div className="aspect-video w-full">
              <iframe src={embedUrl} className="w-full h-full" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen title={client.name} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ClientProfile({ client, onClose }: { client: DsClient; onClose: () => void }) {
  const vis = getVisibleFields(client.visibleFields, DEFAULT_DS_CLIENT_VISIBILITY);
  const linkItems = [
    { key: "songLink1", value: client.songLink1, label: "Song", icon: Music },
    { key: "songLink2", value: client.songLink2, label: "Song", icon: Music },
    { key: "videoLink1", value: client.videoLink1, label: "Video", icon: Video },
    { key: "videoLink2", value: client.videoLink2, label: "Video", icon: Video },
    { key: "customLink1", value: client.customLink1, label: "Link", icon: LinkIcon },
    { key: "customLink2", value: client.customLink2, label: "Link", icon: LinkIcon },
    { key: "customLink3", value: client.customLink3, label: "Link", icon: LinkIcon },
    { key: "customLink4", value: client.customLink4, label: "Link", icon: LinkIcon },
    { key: "customLink5", value: client.customLink5, label: "Link", icon: LinkIcon },
  ];
  const members = client.members ? client.members.split(",").map((m) => m.trim()).filter(Boolean) : [];

  return (
    <div className="rounded-2xl border bg-background overflow-hidden shadow-lg" data-testid={`profile-ds-client-${client.id}`}>
      <button className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/50 transition-colors border-b" onClick={onClose}>
        <span>{client.name}</span>
        <ChevronUp className="w-4 h-4 text-muted-foreground" />
      </button>
      <div className="space-y-0">
        {vis.imageUrl !== false && (
          <div className="w-full">
            {client.imageUrl ? (
              <SmartImage src={client.imageUrl} alt={client.name} className="w-full aspect-video" focal={(vis["imageFocal"] as string) || "center"} data-testid={`img-ds-client-hero-${client.id}`} />
            ) : (
              <ImagePlaceholder label="Client Image" className="w-full aspect-video" />
            )}
          </div>
        )}
        <div className="px-4 py-6 space-y-4">
          {vis.name !== false && (
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div>
                <h2 className="text-2xl font-bold" data-testid={`text-ds-client-name-${client.id}`}>{client.name}</h2>
                {vis.genre !== false && client.genre && <p className="text-sm text-muted-foreground">{client.genre}</p>}
                {vis.timeSlot !== false && client.timeSlot && <p className="text-xs text-muted-foreground mt-1">{client.timeSlot}</p>}
              </div>
              <ShareButton title={client.name || "Client"} />
            </div>
          )}
          {vis.origin !== false && client.origin && <div className="text-sm text-muted-foreground">{client.origin}</div>}
          {vis.members !== false && members.length > 0 && (
            <div className="space-y-1">
              <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Members</h3>
              <div className="flex flex-wrap gap-1">{members.map((m) => <Badge key={m} variant="secondary" className="text-xs">{m}</Badge>)}</div>
            </div>
          )}
          {vis.bio !== false && client.bio && <div className="border-t pt-4"><p className="text-sm leading-relaxed">{client.bio}</p></div>}
          {vis.description !== false && client.description && <div className="border-t pt-4"><p className="text-sm leading-relaxed">{client.description}</p></div>}

          {(client.email || client.phone || client.website || client.socialLinks) && (
            <div className="border-t pt-4 space-y-2">
              <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Contact</h3>
              {vis.email !== false && client.email && (
                <a href={`mailto:${client.email}`} className="flex items-center gap-2 text-sm text-primary underline-offset-2 hover:underline rounded-md px-2 py-1.5">
                  <Mail className="w-4 h-4" />{client.email}
                </a>
              )}
              {vis.phone !== false && client.phone && (
                <a href={`tel:${client.phone}`} className="flex items-center gap-2 text-sm text-primary underline-offset-2 hover:underline rounded-md px-2 py-1.5">
                  <Phone className="w-4 h-4" />{client.phone}
                </a>
              )}
              {vis.website !== false && client.website && (
                <a href={client.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-primary underline-offset-2 hover:underline rounded-md px-2 py-1.5">
                  <Globe className="w-4 h-4" />{client.website}
                </a>
              )}
              {vis.socialLinks !== false && client.socialLinks && (
                <a href={client.socialLinks} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-primary underline-offset-2 hover:underline rounded-md px-2 py-1.5">
                  <Globe className="w-4 h-4" />{client.socialLinks}
                </a>
              )}
            </div>
          )}

          {(client.videoLink1 || client.videoLink2 || client.songLink1 || client.songLink2) && (
            <div className="border-t pt-4">
              <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">Listen / Watch</h3>
              <DSStreamingPlayer client={client} />
            </div>
          )}

          {linkItems.some((l) => vis[l.key] !== false && l.value) && (
            <div className="border-t pt-4">
              <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">Links</h3>
              <div className="grid grid-cols-2 gap-3">
                {linkItems.map((l) => {
                  if (vis[l.key] === false || !l.value) return null;
                  const Icon = l.icon;
                  return (
                    <a
                      key={l.key}
                      href={l.value}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-2xl border bg-background overflow-hidden group hover:shadow-md transition-shadow"
                      style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}
                      data-testid={`link-ds-client-${l.key}-${client.id}`}
                    >
                      <div className="aspect-square bg-muted flex items-center justify-center">
                        <Icon className="w-8 h-8 text-muted-foreground group-hover:text-foreground transition-colors" />
                      </div>
                      <div className="p-2">
                        <p className="text-xs font-medium">{l.label}</p>
                        <p className="text-xs text-muted-foreground truncate">{l.value.replace(/^https?:\/\//, "")}</p>
                      </div>
                    </a>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        {vis.imageUrl2 !== false && client.imageUrl2 && <img src={client.imageUrl2} alt={`${client.name} image 2`} className="w-full h-48 object-cover" />}
        {vis.promoterImageUrl !== false && client.promoterImageUrl && <img src={client.promoterImageUrl} alt="Promoter" className="w-full h-32 object-cover" />}
      </div>
    </div>
  );
}

export default function DSPage() {
  const { get } = useSettings();
  const title = get("ds_page_title", "DS");
  const content = get("ds_content_text", "[ DS content area -- customisable ]");
  const image = get("ds_content_image");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const { data: clients, isLoading } = useQuery<DsClient[]>({ queryKey: ["/api/ds-clients"] });
  const selectedClient = clients?.find((c) => c.id === selectedId) || null;

  return (
    <AppLayout bgKey="bg_ds">
      <div className="px-4 py-4">
        <h2 className="text-lg font-semibold mb-4" data-testid="text-ds-title">{title}</h2>
        <div className="space-y-4">
          <SiteStreamingBanner />
          {image ? (
            <img src={image} alt={title} className="w-full h-48 object-cover rounded-2xl shadow-md" data-testid="img-ds-content" />
          ) : (
            <ImagePlaceholder label="DS Content" className="w-full h-48" />
          )}
          <p className="text-sm text-muted-foreground text-center" data-testid="text-ds-content">{content}</p>
        </div>
      </div>

      {isLoading ? (
        <div className="px-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">{[1,2,3,4].map((i) => <Skeleton key={i} className="aspect-square rounded-2xl" />)}</div>
        </div>
      ) : clients && clients.length > 0 ? (
        <div className="px-4 pb-8 space-y-6 border-t mt-4 pt-4">
          {!selectedClient && (
            <div className="grid grid-cols-2 gap-3">
              {clients.map((client) => (
                <ClientTile key={client.id} client={client} onSelect={(id) => setSelectedId(id)} />
              ))}
            </div>
          )}
          {selectedClient && (
            <ClientProfile client={selectedClient} onClose={() => setSelectedId(null)} />
          )}
          {selectedClient && clients.filter((c) => c.id !== selectedId).length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-3">Other profiles</p>
              <div className="grid grid-cols-2 gap-3">
                {clients.filter((c) => c.id !== selectedId).map((client) => (
                  <ClientTile key={client.id} client={client} onSelect={(id) => { setSelectedId(id); window.scrollTo({ top: 0, behavior: "smooth" }); }} />
                ))}
              </div>
            </div>
          )}
        </div>
      ) : null}
    </AppLayout>
  );
}
