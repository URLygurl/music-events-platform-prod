import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/app-layout";
import { SearchBar } from "@/components/search-bar";
import { ArtistTile } from "@/components/artist-tile";
import { EnquiryForm } from "@/components/enquiry-form";
import { ImagePlaceholder } from "@/components/image-placeholder";
import { Skeleton } from "@/components/ui/skeleton";
import { MediaPlayer } from "@/components/media-player";
import { SocialLinks } from "@/components/social-links";
import { AnimationBoxes } from "@/components/animation-box";
import { ShareButton } from "@/components/share-button";
import { useSettings } from "@/hooks/use-settings";
import type { Artist, Event } from "@shared/schema";

export default function LandingPage() {
  const [search, setSearch] = useState("");
  const { get } = useSettings();

  const { data: artists, isLoading: loadingArtists } = useQuery<Artist[]>({
    queryKey: ["/api/artists"],
  });

  const { data: events } = useQuery<Event[]>({
    queryKey: ["/api/events"],
  });

  const featuredArtists = artists?.filter((a) => a.featured).slice(0, 4) || [];
  const currentEvent = events?.[0];

  const headingText = get("landing_heading_text", "[ Heading Text ]");
  const searchPlaceholder = get("landing_search_placeholder", "Search artists...");
  const bannerImage = get("landing_banner_image");
  const enquiryTitle = get("landing_enquiry_title", "Enquire / Subscribe");

  return (
    <AppLayout bgKey="bg_landing">
      <div className="border-b px-4 py-3">
        <p className="text-xs uppercase tracking-wider text-muted-foreground text-center" data-testid="text-heading-banner">
          {headingText}
        </p>
      </div>

      <div className="px-4 py-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight" data-testid="text-event-name">
          {currentEvent?.name || "[ Event Name ]"}
        </h1>
      </div>

      <div className="px-4 pb-6">
        <SearchBar value={search} onChange={setSearch} placeholder={searchPlaceholder} />
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
        <MediaPlayer />
      </div>

      <div className="px-4 pb-6">
        <AnimationBoxes />
      </div>

      <div className="px-4 pb-8">
        <EnquiryForm title={enquiryTitle} />
      </div>

      <div className="px-4 pb-6 flex items-center justify-between gap-2 flex-wrap">
        <SocialLinks />
        <ShareButton title={currentEvent?.name || "Check this out"} size="sm" variant="outline" />
      </div>

      {bannerImage ? (
        <img src={bannerImage} alt="Banner" className="w-full h-40 object-cover rounded-xl" data-testid="img-banner" />
      ) : (
        <ImagePlaceholder label="Banner Image" className="w-full h-40 rounded-xl" />
      )}
    </AppLayout>
  );
}
