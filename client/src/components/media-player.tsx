import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Music,
  Video,
  X,
  Maximize2,
  Minimize2,
  List,
} from "lucide-react";
import type { MediaItem } from "@shared/schema";

// ── URL parsers ──────────────────────────────────────────────────────────────

export function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&?\s]+)/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

export function extractSpotifyEmbed(url: string): string | null {
  // Convert open.spotify.com/track/... or /album/... or /playlist/... to embed URL
  const m = url.match(/open\.spotify\.com\/(track|album|playlist|episode|show)\/([a-zA-Z0-9]+)/);
  if (m) return `https://open.spotify.com/embed/${m[1]}/${m[2]}?utm_source=generator&theme=0`;
  // Already an embed URL
  if (url.includes("open.spotify.com/embed")) return url;
  return null;
}

export function extractAppleMusicEmbed(url: string): string | null {
  // Convert music.apple.com/... to embed URL
  const m = url.match(/music\.apple\.com\/([a-z]{2})\/(album|playlist|song)\/([^/]+)\/([^?]+)/);
  if (m) return `https://embed.music.apple.com/${m[1]}/${m[2]}/${m[3]}/${m[4]}`;
  if (url.includes("embed.music.apple.com")) return url;
  return null;
}

// ── Detect type from URL if not specified ────────────────────────────────────

export function detectMediaType(url: string): string {
  if (!url) return "audio";
  if (url.includes("youtube.com") || url.includes("youtu.be")) return "youtube";
  if (url.includes("bandcamp.com")) return "bandcamp";
  if (url.includes("soundcloud.com")) return "soundcloud";
  if (url.includes("spotify.com")) return "spotify";
  if (url.includes("music.apple.com") || url.includes("embed.music.apple.com")) return "apple_music";
  // Raw IP addresses or non-standard hosts serving HTML stream pages
  if (/^https?:\/\/\d{1,3}(\.\d{1,3}){3}(:\d+)?/.test(url) || url.endsWith(".html") || url.endsWith(".htm")) return "iframe_stream";
  return "audio";
}

// ── MediaEmbed — exported so DS page can reuse it ───────────────────────────

export function MediaEmbed({
  item,
  expanded,
}: {
  item: Pick<MediaItem, "id" | "title" | "type" | "embedUrl">;
  expanded: boolean;
}) {
  if (item.type === "youtube") {
    const videoId = extractYouTubeId(item.embedUrl);
    if (!videoId) return <p className="text-xs text-muted-foreground">Invalid YouTube URL</p>;
    return (
      <div className={`w-full ${expanded ? "aspect-video" : "aspect-video max-h-48"}`}>
        <iframe
          src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
          className="w-full h-full rounded-md"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          title={item.title}
          data-testid={`player-youtube-${item.id}`}
        />
      </div>
    );
  }

  if (item.type === "bandcamp") {
    if (!item.embedUrl.includes("bandcamp.com")) {
      return <p className="text-xs text-muted-foreground">Invalid Bandcamp URL</p>;
    }
    return (
      <iframe
        src={item.embedUrl}
        className="w-full h-32 rounded-md border-0"
        seamless
        title={item.title}
        data-testid={`player-bandcamp-${item.id}`}
      />
    );
  }

  if (item.type === "soundcloud") {
    return (
      <iframe
        width="100%"
        height="166"
        scrolling="no"
        frameBorder="no"
        allow="autoplay"
        src={`https://w.soundcloud.com/player/?url=${encodeURIComponent(item.embedUrl)}&color=%23000000&auto_play=true&hide_related=true&show_comments=false&show_user=true&show_reposts=false&show_teaser=false`}
        className="rounded-md"
        title={item.title}
        data-testid={`player-soundcloud-${item.id}`}
      />
    );
  }

  if (item.type === "spotify") {
    const embedSrc = extractSpotifyEmbed(item.embedUrl);
    if (!embedSrc) return <p className="text-xs text-muted-foreground">Invalid Spotify URL</p>;
    return (
      <iframe
        src={embedSrc}
        width="100%"
        height={expanded ? "352" : "152"}
        frameBorder="0"
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        loading="lazy"
        className="rounded-xl"
        title={item.title}
        data-testid={`player-spotify-${item.id}`}
      />
    );
  }

  if (item.type === "apple_music") {
    const embedSrc = extractAppleMusicEmbed(item.embedUrl);
    if (!embedSrc) return <p className="text-xs text-muted-foreground">Invalid Apple Music URL</p>;
    return (
      <iframe
        allow="autoplay *; encrypted-media *; fullscreen *; clipboard-write"
        frameBorder="0"
        height={expanded ? "450" : "175"}
        style={{ width: "100%", maxWidth: "660px", overflow: "hidden", borderRadius: "10px" }}
        sandbox="allow-forms allow-popups allow-same-origin allow-scripts allow-storage-access-by-user-activation allow-top-navigation-by-user-activation"
        src={embedSrc}
        title={item.title}
        data-testid={`player-apple-music-${item.id}`}
      />
    );
  }

  if (item.type === "audio") {
    return (
      <audio controls autoPlay className="w-full" data-testid={`player-audio-${item.id}`}>
        <source src={item.embedUrl} />
      </audio>
    );
  }

  if (item.type === "iframe_stream") {
    return (
      <div className={`w-full ${expanded ? "aspect-video" : "aspect-video max-h-48"}`}>
        <iframe
          src={item.embedUrl}
          className="w-full h-full rounded-md border-0"
          allow="autoplay; fullscreen"
          allowFullScreen
          title={item.title}
          data-testid={`player-iframe-stream-${item.id}`}
        />
      </div>
    );
  }

  return <p className="text-xs text-muted-foreground">Unsupported media type</p>;
}

// ── MediaPlayer — full playlist player used on landing page ─────────────────

export function MediaPlayer() {
  const { data: mediaItems, isLoading } = useQuery<MediaItem[]>({
    queryKey: ["/api/media"],
  });

  const [currentIndex, setCurrentIndex] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [showPlaylist, setShowPlaylist] = useState(true);

  if (isLoading || !mediaItems || mediaItems.length === 0) return null;

  const current = currentIndex !== null ? mediaItems[currentIndex] : null;

  const playItem = (index: number) => {
    setCurrentIndex(index);
  };

  const next = () => {
    if (currentIndex === null) return;
    setCurrentIndex((currentIndex + 1) % mediaItems.length);
  };

  const prev = () => {
    if (currentIndex === null) return;
    setCurrentIndex((currentIndex - 1 + mediaItems.length) % mediaItems.length);
  };

  return (
    <div className="space-y-3">
      {current && (
        <Card className="overflow-visible">
          <div className="p-3 border-b flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-xl border flex items-center justify-center flex-shrink-0">
                {current.type === "youtube" ? (
                  <Video className="w-4 h-4" />
                ) : (
                  <Music className="w-4 h-4" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate" data-testid="text-now-playing-title">{current.title}</p>
                {current.artist && (
                  <p className="text-xs text-muted-foreground truncate">{current.artist}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <Button size="icon" variant="ghost" onClick={prev} data-testid="button-player-prev">
                <SkipBack className="w-4 h-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={next} data-testid="button-player-next">
                <SkipForward className="w-4 h-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => setExpanded(!expanded)}>
                {expanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </Button>
              <Button size="icon" variant="ghost" onClick={() => setCurrentIndex(null)} data-testid="button-player-close">
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <div className="p-3">
            <MediaEmbed item={current} expanded={expanded} />
          </div>
        </Card>
      )}

      <div className="flex items-center justify-between gap-2 px-1">
        <h3 className="text-sm font-semibold flex items-center gap-2 bg-background/90 backdrop-blur-sm px-2 py-1 rounded-lg">
          <Music className="w-4 h-4" />
          Media
        </h3>
        <Button size="icon" variant="ghost" className="bg-background/80 backdrop-blur-sm" onClick={() => setShowPlaylist(!showPlaylist)}>
          <List className="w-4 h-4" />
        </Button>
      </div>

      {showPlaylist && (
        <div className="space-y-2">
          {mediaItems.map((item, i) => (
            <button
              key={item.id}
              onClick={() => playItem(i)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all border shadow-sm ${
                currentIndex === i
                  ? "bg-foreground text-background border-foreground"
                  : "bg-background/95 backdrop-blur-sm border-border hover:border-foreground/30 hover:shadow-md"
              }`}
              data-testid={`button-play-media-${item.id}`}
            >
              <div className="w-8 h-8 rounded-xl border flex items-center justify-center flex-shrink-0"
                style={currentIndex === i ? { borderColor: "currentColor" } : {}}
              >
                {currentIndex === i ? (
                  <Pause className="w-3.5 h-3.5" />
                ) : (
                  <Play className="w-3.5 h-3.5" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{item.title}</p>
                <p className={`text-xs truncate ${currentIndex === i ? "opacity-70" : "text-muted-foreground"}`}>
                  {item.artist || item.type}
                </p>
              </div>
              <span className={`text-xs flex-shrink-0 ${currentIndex === i ? "opacity-70" : "text-muted-foreground"}`}>
                {item.type}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
