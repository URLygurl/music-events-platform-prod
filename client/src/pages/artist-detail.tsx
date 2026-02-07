import { useQuery } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { AppLayout } from "@/components/app-layout";
import { SearchBar } from "@/components/search-bar";
import { ImagePlaceholder } from "@/components/image-placeholder";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Mail, Phone, Globe, Music, Video, LinkIcon } from "lucide-react";
import { ShareButton } from "@/components/share-button";
import { useState } from "react";
import type { Artist } from "@shared/schema";
import { getVisibleFields, DEFAULT_ARTIST_VISIBILITY } from "@shared/schema";

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

  const vis = getVisibleFields(artist.visibleFields, DEFAULT_ARTIST_VISIBILITY);

  const linkItems = [
    { key: "songLink1", value: artist.songLink1, label: "Song", icon: Music },
    { key: "songLink2", value: artist.songLink2, label: "Song", icon: Music },
    { key: "videoLink1", value: artist.videoLink1, label: "Video", icon: Video },
    { key: "videoLink2", value: artist.videoLink2, label: "Video", icon: Video },
    { key: "customLink1", value: artist.customLink1, label: "Link", icon: LinkIcon },
    { key: "customLink2", value: artist.customLink2, label: "Link", icon: LinkIcon },
    { key: "customLink3", value: artist.customLink3, label: "Link", icon: LinkIcon },
    { key: "customLink4", value: artist.customLink4, label: "Link", icon: LinkIcon },
    { key: "customLink5", value: artist.customLink5, label: "Link", icon: LinkIcon },
  ];

  const members = artist.members ? artist.members.split(",").map((m) => m.trim()).filter(Boolean) : [];

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
        <ShareButton title={artist.name} />
      </div>

      {vis.imageUrl !== false && (
        <div className="w-full">
          {artist.imageUrl ? (
            <img
              src={artist.imageUrl}
              alt={artist.name}
              className="w-full aspect-video object-cover rounded-b-2xl shadow-md"
              data-testid="img-artist-hero"
            />
          ) : (
            <ImagePlaceholder label="Artist Hero Image" className="w-full aspect-video rounded-b-2xl" />
          )}
        </div>
      )}

      <div className="px-4 py-6 space-y-4">
        {vis.name !== false && (
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-artist-name">{artist.name}</h1>
            {vis.genre !== false && artist.genre && (
              <p className="text-sm text-muted-foreground">{artist.genre}</p>
            )}
            {vis.timeSlot !== false && artist.timeSlot && (
              <p className="text-xs text-muted-foreground mt-1">{artist.timeSlot}</p>
            )}
          </div>
        )}

        {vis.origin !== false && artist.origin && (
          <div className="text-sm text-muted-foreground" data-testid="text-artist-origin">
            Origin: {artist.origin}
          </div>
        )}

        {vis.members !== false && members.length > 0 && (
          <div className="space-y-1" data-testid="section-members">
            <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Members</h3>
            <div className="flex flex-wrap gap-1">
              {members.map((m) => (
                <Badge key={m} variant="secondary" className="text-xs">{m}</Badge>
              ))}
            </div>
          </div>
        )}

        {vis.bio !== false && artist.bio && (
          <div className="border-t pt-4">
            <p className="text-sm leading-relaxed" data-testid="text-artist-bio">{artist.bio}</p>
          </div>
        )}

        {vis.description !== false && artist.description && (
          <div className="border-t pt-4">
            <p className="text-sm leading-relaxed" data-testid="text-artist-description">
              {artist.description}
            </p>
          </div>
        )}

        <div className="border-t pt-4 space-y-2">
          <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Contact</h3>
          {vis.email !== false && artist.email && (
            <a href={`mailto:${artist.email}`} className="flex items-center gap-2 text-sm hover-elevate rounded-md px-2 py-1.5" data-testid="link-email">
              <Mail className="w-4 h-4 text-muted-foreground" />
              {artist.email}
            </a>
          )}
          {vis.phone !== false && artist.phone && (
            <a href={`tel:${artist.phone}`} className="flex items-center gap-2 text-sm hover-elevate rounded-md px-2 py-1.5" data-testid="link-phone">
              <Phone className="w-4 h-4 text-muted-foreground" />
              {artist.phone}
            </a>
          )}
          {vis.website !== false && artist.website && (
            <a href={artist.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm hover-elevate rounded-md px-2 py-1.5" data-testid="link-website">
              <Globe className="w-4 h-4 text-muted-foreground" />
              {artist.website}
            </a>
          )}
          {vis.socialLinks !== false && artist.socialLinks && (
            <a href={artist.socialLinks} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm hover-elevate rounded-md px-2 py-1.5" data-testid="link-social">
              <Globe className="w-4 h-4 text-muted-foreground" />
              {artist.socialLinks}
            </a>
          )}
        </div>

        {linkItems.some((l) => vis[l.key] !== false && l.value) && (
          <div className="border-t pt-4 space-y-2">
            <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Links</h3>
            {linkItems.map((l) => {
              if (vis[l.key] === false || !l.value) return null;
              const Icon = l.icon;
              return (
                <a
                  key={l.key}
                  href={l.value}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm hover-elevate rounded-md px-2 py-1.5"
                  data-testid={`link-${l.key}`}
                >
                  <Icon className="w-4 h-4 text-muted-foreground" />
                  {l.value}
                </a>
              );
            })}
          </div>
        )}
      </div>

      {vis.imageUrl2 !== false && (
        <div className="w-full">
          {artist.imageUrl2 ? (
            <img
              src={artist.imageUrl2}
              alt={`${artist.name} image 2`}
              className="w-full h-48 object-cover rounded-2xl shadow-md"
              data-testid="img-artist-secondary"
            />
          ) : (
            <ImagePlaceholder label="Artist Image 2" className="w-full h-48 rounded-2xl" />
          )}
        </div>
      )}

      {vis.promoterImageUrl !== false && (
        <div className="w-full">
          {artist.promoterImageUrl ? (
            <img
              src={artist.promoterImageUrl}
              alt="Promoter"
              className="w-full h-32 object-cover rounded-2xl shadow-md"
            />
          ) : (
            <ImagePlaceholder label="Promoter Image" className="w-full h-32 rounded-2xl" />
          )}
        </div>
      )}
    </AppLayout>
  );
}
