import { useState } from "react";
import { Link } from "wouter";
import { Play, X } from "lucide-react";
import { ImagePlaceholder } from "./image-placeholder";
import { SmartImage } from "./smart-image";
import type { Artist } from "@shared/schema";
import { getVisibleFields } from "@shared/schema";

interface ArtistTileProps {
  artist: Artist;
}

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

export function ArtistTile({ artist }: ArtistTileProps) {
  const [playing, setPlaying] = useState(false);
  const visFields = getVisibleFields(artist.visibleFields);
  const focal = (visFields["imageFocal"] as string | undefined) || "center";
  const videoUrl = artist.videoLink1 || artist.videoLink2 || "";
  const embedUrl = videoUrl ? getEmbedUrl(videoUrl) : null;
  const hasVideo = !!videoUrl;

  const handlePlay = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (embedUrl) {
      setPlaying(true);
    } else if (videoUrl) {
      window.open(videoUrl, "_blank");
    }
  };

  return (
    <>
      <Link href={`/artists/${artist.id}`}>
        <div
          className="rounded-2xl border bg-background cursor-pointer group overflow-hidden"
          style={{ boxShadow: "0 4px 16px rgba(0,0,0,0.10)" }}
          data-testid={`card-artist-${artist.id}`}
        >
          <div className="relative">
            {artist.imageUrl && artist.imageUrl !== "" ? (
              <SmartImage
                src={artist.imageUrl}
                alt={artist.name}
                className="w-full aspect-square"
                focal={focal}
              />
            ) : (
              <ImagePlaceholder label={artist.name} className="w-full aspect-square" />
            )}
            {hasVideo && (
              <button
                className="absolute bottom-2 right-2 w-11 h-11 rounded-full border-2 bg-background/80 backdrop-blur-sm flex items-center justify-center shadow-md hover:bg-background transition-colors"
                onClick={handlePlay}
                data-testid={`button-play-${artist.id}`}
                title="Play video"
              >
                <Play className="w-5 h-5 fill-foreground" />
              </button>
            )}
          </div>
          <div className="p-3">
            <p className="text-sm font-medium truncate" data-testid={`text-artist-name-${artist.id}`}>
              {artist.name}
            </p>
            <p className="text-xs text-muted-foreground truncate">{artist.genre}</p>
          </div>
        </div>
      </Link>

      {playing && embedUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setPlaying(false)}
          data-testid={`modal-video-${artist.id}`}
        >
          <div
            className="relative w-full max-w-lg rounded-2xl overflow-hidden bg-black shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-2 bg-black/90">
              <div>
                <p className="text-sm font-medium text-white truncate">{artist.name}</p>
                <p className="text-xs text-white/60 truncate">{artist.genre}</p>
              </div>
              <button
                className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
                onClick={() => setPlaying(false)}
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>
            <div className="aspect-video w-full">
              <iframe
                src={embedUrl}
                className="w-full h-full"
                allow="autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
                title={artist.name}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
