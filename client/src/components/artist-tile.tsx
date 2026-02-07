import { Link } from "wouter";
import { Play } from "lucide-react";
import { ImagePlaceholder } from "./image-placeholder";
import type { Artist } from "@shared/schema";

interface ArtistTileProps {
  artist: Artist;
}

export function ArtistTile({ artist }: ArtistTileProps) {
  return (
    <Link href={`/artists/${artist.id}`}>
      <div
        className="rounded-md border bg-background cursor-pointer group"
        style={{ boxShadow: "3px 4px 0px 0px hsl(var(--foreground) / 0.12)" }}
        data-testid={`card-artist-${artist.id}`}
      >
        <div className="relative">
          {artist.imageUrl && artist.imageUrl !== "" ? (
            <img
              src={artist.imageUrl}
              alt={artist.name}
              className="w-full aspect-square object-cover rounded-t-md"
            />
          ) : (
            <ImagePlaceholder label={artist.name} className="w-full aspect-square rounded-t-md rounded-b-none" />
          )}
          <button
            className="absolute bottom-2 right-2 w-8 h-8 rounded-full border bg-background/80 flex items-center justify-center"
            onClick={(e) => e.preventDefault()}
            data-testid={`button-play-${artist.id}`}
          >
            <Play className="w-3.5 h-3.5 fill-foreground" />
          </button>
        </div>
        <div className="p-3">
          <p className="text-sm font-medium truncate" data-testid={`text-artist-name-${artist.id}`}>
            {artist.name}
          </p>
          <p className="text-xs text-muted-foreground truncate">{artist.genre}</p>
        </div>
      </div>
    </Link>
  );
}
