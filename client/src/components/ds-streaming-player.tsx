/**
 * DSStreamingPlayer
 *
 * Renders inline embedded players for a DS client's song/video links.
 * Uses the shared MediaEmbed logic from media-player.tsx.
 * Supports YouTube, Bandcamp, SoundCloud, Spotify, Apple Music, and raw audio.
 *
 * Also exports SiteStreamingBanner — a site-wide "Now Streaming" banner
 * driven by ds_stream_url + ds_stream_type site settings.
 */

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MediaEmbed, detectMediaType } from "@/components/media-player";
import { useSettings } from "@/hooks/use-settings";
import { Play, Music, Video, Radio, X, ChevronDown, ChevronUp } from "lucide-react";
import type { DsClient } from "@shared/schema";

// ── Inline client streaming player ──────────────────────────────────────────

interface StreamItem {
  id: string;
  title: string;
  url: string;
  type: string;
}

function buildStreamItems(client: DsClient): StreamItem[] {
  const items: StreamItem[] = [];
  const add = (key: string, url: string | null | undefined, label: string) => {
    if (!url) return;
    const type = detectMediaType(url);
    items.push({ id: `${client.id}-${key}`, title: label, url, type });
  };
  add("video1", client.videoLink1, "Video 1");
  add("video2", client.videoLink2, "Video 2");
  add("song1", client.songLink1, "Song 1");
  add("song2", client.songLink2, "Song 2");
  return items;
}

function typeIcon(type: string) {
  if (type === "youtube") return <Video className="w-3.5 h-3.5" />;
  return <Music className="w-3.5 h-3.5" />;
}

function typeLabel(type: string): string {
  const map: Record<string, string> = {
    youtube: "YouTube",
    bandcamp: "Bandcamp",
    soundcloud: "SoundCloud",
    spotify: "Spotify",
    apple_music: "Apple Music",
    audio: "Audio",
  };
  return map[type] || type;
}

export function DSStreamingPlayer({ client }: { client: DsClient }) {
  const items = buildStreamItems(client);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  if (items.length === 0) return null;

  const active = items.find((i) => i.id === activeId);

  return (
    <div className="space-y-2" data-testid={`ds-streaming-player-${client.id}`}>
      {/* Now playing embed */}
      {active && (
        <Card className="overflow-hidden">
          <div className="px-3 py-2 border-b flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg border flex items-center justify-center flex-shrink-0">
                {typeIcon(active.type)}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium truncate">{active.title}</p>
                <p className="text-xs text-muted-foreground">{typeLabel(active.type)}</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => setActiveId(null)}
                data-testid={`button-close-stream-${client.id}`}
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
          <div className="p-3">
            <MediaEmbed
              item={{ id: 0, title: active.title, type: active.type, embedUrl: active.url }}
              expanded={expanded}
            />
          </div>
        </Card>
      )}

      {/* Track list */}
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveId(activeId === item.id ? null : item.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${
              activeId === item.id
                ? "bg-foreground text-background border-foreground"
                : "bg-background hover:bg-muted border-border"
            }`}
            data-testid={`button-play-stream-${item.id}`}
          >
            {activeId === item.id ? (
              <span className="w-3 h-3 rounded-full bg-current opacity-70 animate-pulse flex-shrink-0" />
            ) : (
              <Play className="w-3 h-3 flex-shrink-0" />
            )}
            {item.title}
            <Badge
              variant="outline"
              className={`text-xs px-1 py-0 ml-0.5 ${activeId === item.id ? "border-current opacity-70" : ""}`}
            >
              {typeLabel(item.type)}
            </Badge>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Site-wide "Now Streaming" banner ─────────────────────────────────────────

export function SiteStreamingBanner() {
  const { get } = useSettings();
  const [active, setActive] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const streamUrl = get("ds_stream_url", "");
  const streamType = get("ds_stream_type", "");
  const streamTitle = get("ds_stream_title", "Now Streaming");
  const streamEnabled = get("ds_stream_enabled", "false") === "true";

  if (!streamEnabled || !streamUrl) return null;

  const type = streamType || detectMediaType(streamUrl);

  return (
    <div className="space-y-2" data-testid="site-streaming-banner">
      {active && (
        <Card className="overflow-hidden">
          <div className="px-3 py-2 border-b flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Radio className="w-4 h-4 text-muted-foreground flex-shrink-0 animate-pulse" />
              <p className="text-sm font-medium truncate">{streamTitle}</p>
            </div>
            <div className="flex items-center gap-1">
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setExpanded(!expanded)}>
                {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setActive(false)} data-testid="button-close-site-stream">
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
          <div className="p-3">
            <MediaEmbed
              item={{ id: 0, title: streamTitle, type, embedUrl: streamUrl }}
              expanded={expanded}
            />
          </div>
        </Card>
      )}

      {!active && (
        <button
          onClick={() => setActive(true)}
          className="w-full flex items-center gap-2 px-4 py-3 rounded-xl border bg-background hover:bg-muted transition-colors text-left"
          data-testid="button-open-site-stream"
        >
          <Radio className="w-4 h-4 text-muted-foreground animate-pulse flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{streamTitle}</p>
            <p className="text-xs text-muted-foreground">{typeLabel(type)} · Tap to play</p>
          </div>
          <Play className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        </button>
      )}
    </div>
  );
}
