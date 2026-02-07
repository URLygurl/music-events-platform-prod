import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { AppLayout } from "@/components/app-layout";
import { SearchBar } from "@/components/search-bar";
import { ImagePlaceholder } from "@/components/image-placeholder";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronRight } from "lucide-react";
import { useSettings } from "@/hooks/use-settings";
import type { Artist } from "@shared/schema";

export default function ArtistsDirectoryPage() {
  const [search, setSearch] = useState("");
  const { get } = useSettings();

  const { data: artists, isLoading } = useQuery<Artist[]>({
    queryKey: ["/api/artists"],
  });

  const pageTitle = get("artists_page_title", "Artists");

  const filtered = search
    ? artists?.filter((a) =>
        a.name.toLowerCase().includes(search.toLowerCase()) ||
        a.genre.toLowerCase().includes(search.toLowerCase())
      )
    : artists;

  return (
    <AppLayout bgKey="bg_artists">
      <div className="px-4 py-4">
        <h2 className="text-lg font-semibold mb-3" data-testid="text-artists-title">{pageTitle}</h2>
        <SearchBar value={search} onChange={setSearch} placeholder="Search artists..." />
      </div>

      <div className="divide-y">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <Skeleton className="w-12 h-12 rounded-md" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
          ))
        ) : filtered?.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-muted-foreground">
            No artists found
          </div>
        ) : (
          filtered?.map((artist) => (
            <Link key={artist.id} href={`/artists/${artist.id}`}>
              <div
                className="flex items-center gap-3 px-4 py-3 hover-elevate cursor-pointer rounded-xl"
                data-testid={`row-artist-${artist.id}`}
              >
                <div className="w-12 h-12 flex-shrink-0 rounded-xl overflow-hidden">
                  {artist.imageUrl ? (
                    <img
                      src={artist.imageUrl}
                      alt={artist.name}
                      className="w-12 h-12 object-cover rounded-xl"
                    />
                  ) : (
                    <ImagePlaceholder label="" className="w-12 h-12" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{artist.name}</p>
                  <p className="text-xs text-muted-foreground">{artist.genre}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {artist.timeSlot && (
                    <span className="text-xs text-muted-foreground">{artist.timeSlot}</span>
                  )}
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </AppLayout>
  );
}
