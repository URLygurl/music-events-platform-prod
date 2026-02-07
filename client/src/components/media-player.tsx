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

function extractYouTubeId(url: string): string | null {
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

function extractBandcampEmbed(url: string): string | null {
  if (url.includes("bandcamp.com")) return url;
  const m = url.match(/album=(\d+)/);
  if (m) return url;
  return null;
}

function MediaEmbed({ item, expanded }: { item: MediaItem; expanded: boolean }) {
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
    const embedSrc = extractBandcampEmbed(item.embedUrl);
    if (!embedSrc) return <p className="text-xs text-muted-foreground">Invalid Bandcamp URL</p>;
    return (
      <iframe
        src={embedSrc}
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

  if (item.type === "audio") {
    return (
      <audio controls autoPlay className="w-full" data-testid={`player-audio-${item.id}`}>
        <source src={item.embedUrl} />
      </audio>
    );
  }

  return <p className="text-xs text-muted-foreground">Unsupported media type</p>;
}

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

      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <Music className="w-4 h-4" />
          Media
        </h3>
        <Button size="icon" variant="ghost" onClick={() => setShowPlaylist(!showPlaylist)}>
          <List className="w-4 h-4" />
        </Button>
      </div>

      {showPlaylist && (
        <div className="space-y-1">
          {mediaItems.map((item, i) => (
            <button
              key={item.id}
              onClick={() => playItem(i)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${
                currentIndex === i ? "bg-foreground text-background" : "hover-elevate"
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
