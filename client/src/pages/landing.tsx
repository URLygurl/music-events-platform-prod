import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/app-layout";
import { SearchBar } from "@/components/search-bar";
import { ArtistTile } from "@/components/artist-tile";
import { EnquiryForm } from "@/components/enquiry-form";
import { ImagePlaceholder } from "@/components/image-placeholder";
import { Skeleton } from "@/components/ui/skeleton";
import type { Artist, Event } from "@shared/schema";

export default function LandingPage() {
  const [search, setSearch] = useState("");

  const { data: artists, isLoading: loadingArtists } = useQuery<Artist[]>({
    queryKey: ["/api/artists"],
  });

  const { data: events } = useQuery<Event[]>({
    queryKey: ["/api/events"],
  });

  const featuredArtists = artists?.filter((a) => a.featured).slice(0, 4) || [];
  const currentEvent = events?.[0];

  return (
    <AppLayout>
      <div className="border-b px-4 py-3">
        <p className="text-xs uppercase tracking-wider text-muted-foreground text-center" data-testid="text-heading-banner">
          [ Heading Text ]
        </p>
      </div>

      <div className="px-4 py-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight" data-testid="text-event-name">
          {currentEvent?.name || "[ Event Name ]"}
        </h1>
      </div>

      <div className="px-4 pb-6">
        <SearchBar value={search} onChange={setSearch} placeholder="Search artists..." />
      </div>

      <div className="px-4 pb-8">
        {loadingArtists ? (
          <div className="grid grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="w-full aspect-square rounded-md" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {(search
              ? artists?.filter((a) =>
                  a.name.toLowerCase().includes(search.toLowerCase())
                )
              : featuredArtists
            )?.map((artist) => (
              <ArtistTile key={artist.id} artist={artist} />
            ))}
          </div>
        )}
      </div>

      <div className="px-4 pb-8">
        <EnquiryForm />
      </div>

      <ImagePlaceholder label="Banner Image" className="w-full h-40 rounded-none" />
    </AppLayout>
  );
}
