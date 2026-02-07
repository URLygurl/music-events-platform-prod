import { useQuery } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { AppLayout } from "@/components/app-layout";
import { SearchBar } from "@/components/search-bar";
import { ImagePlaceholder } from "@/components/image-placeholder";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Mail, Phone, Globe } from "lucide-react";
import { useState } from "react";
import type { Artist } from "@shared/schema";

export default function ArtistDetailPage() {
  const [, params] = useRoute("/artists/:id");
  const artistId = params?.id;
  const [search, setSearch] = useState("");

  const { data: artist, isLoading } = useQuery<Artist>({
    queryKey: ["/api/artists", artistId],
    enabled: !!artistId,
  });

  if (isLoading) {
    return (
      <AppLayout showTopRibbon={false}>
        <div className="px-4 py-4 space-y-4">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="w-full aspect-video" />
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-20 w-full" />
        </div>
      </AppLayout>
    );
  }

  if (!artist) {
    return (
      <AppLayout showTopRibbon={false}>
        <div className="px-4 py-12 text-center">
          <p className="text-muted-foreground">Artist not found</p>
          <Link href="/artists">
            <Button variant="ghost" className="mt-4" data-testid="button-back-to-artists">
              Back to Artists
            </Button>
          </Link>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout showTopRibbon={false}>
      <div className="px-4 py-3 flex items-center gap-2">
        <Link href="/artists">
          <Button size="icon" variant="ghost" data-testid="button-back">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <SearchBar value={search} onChange={setSearch} placeholder="Search..." />
        </div>
      </div>

      <div className="w-full">
        {artist.imageUrl ? (
          <img
            src={artist.imageUrl}
            alt={artist.name}
            className="w-full aspect-video object-cover"
            data-testid="img-artist-hero"
          />
        ) : (
          <ImagePlaceholder label="Artist Hero Image" className="w-full aspect-video rounded-none" />
        )}
      </div>

      <div className="px-4 py-6 space-y-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-artist-name">{artist.name}</h1>
          <p className="text-sm text-muted-foreground">{artist.genre}</p>
          {artist.timeSlot && (
            <p className="text-xs text-muted-foreground mt-1">{artist.timeSlot}</p>
          )}
        </div>

        <div className="border-t pt-4">
          <p className="text-sm leading-relaxed" data-testid="text-artist-description">
            {artist.description}
          </p>
        </div>

        <div className="border-t pt-4 space-y-2">
          <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Contact</h3>
          {artist.email && (
            <a href={`mailto:${artist.email}`} className="flex items-center gap-2 text-sm hover-elevate rounded-md px-2 py-1.5" data-testid="link-email">
              <Mail className="w-4 h-4 text-muted-foreground" />
              {artist.email}
            </a>
          )}
          {artist.phone && (
            <a href={`tel:${artist.phone}`} className="flex items-center gap-2 text-sm hover-elevate rounded-md px-2 py-1.5" data-testid="link-phone">
              <Phone className="w-4 h-4 text-muted-foreground" />
              {artist.phone}
            </a>
          )}
          {artist.socialLinks && (
            <a href={artist.socialLinks} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm hover-elevate rounded-md px-2 py-1.5" data-testid="link-social">
              <Globe className="w-4 h-4 text-muted-foreground" />
              {artist.socialLinks}
            </a>
          )}
        </div>
      </div>

      <div className="w-full">
        {artist.promoterImageUrl ? (
          <img
            src={artist.promoterImageUrl}
            alt="Promoter"
            className="w-full h-32 object-cover"
          />
        ) : (
          <ImagePlaceholder label="Promoter Image" className="w-full h-32 rounded-none" />
        )}
      </div>
    </AppLayout>
  );
}
