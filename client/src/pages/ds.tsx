import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/app-layout";
import { ImagePlaceholder } from "@/components/image-placeholder";
import { useSettings } from "@/hooks/use-settings";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ShareButton } from "@/components/share-button";
import { Mail, Phone, Globe, Music, Video, LinkIcon } from "lucide-react";
import type { DsClient } from "@shared/schema";
import { getVisibleFields, DEFAULT_DS_CLIENT_VISIBILITY } from "@shared/schema";

function ClientProfile({ client }: { client: DsClient }) {
  const vis = getVisibleFields(client.visibleFields, DEFAULT_DS_CLIENT_VISIBILITY);

  const linkItems = [
    { key: "songLink1", value: client.songLink1, label: "Song", icon: Music },
    { key: "songLink2", value: client.songLink2, label: "Song", icon: Music },
    { key: "videoLink1", value: client.videoLink1, label: "Video", icon: Video },
    { key: "videoLink2", value: client.videoLink2, label: "Video", icon: Video },
    { key: "customLink1", value: client.customLink1, label: "Link", icon: LinkIcon },
    { key: "customLink2", value: client.customLink2, label: "Link", icon: LinkIcon },
    { key: "customLink3", value: client.customLink3, label: "Link", icon: LinkIcon },
    { key: "customLink4", value: client.customLink4, label: "Link", icon: LinkIcon },
    { key: "customLink5", value: client.customLink5, label: "Link", icon: LinkIcon },
  ];

  const members = client.members ? client.members.split(",").map((m) => m.trim()).filter(Boolean) : [];

  return (
    <div className="space-y-0">
      {vis.imageUrl !== false && (
        <div className="w-full">
          {client.imageUrl ? (
            <img
              src={client.imageUrl}
              alt={client.name}
              className="w-full aspect-video object-cover rounded-b-2xl shadow-md"
              data-testid={`img-ds-client-hero-${client.id}`}
            />
          ) : (
            <ImagePlaceholder label="Client Image" className="w-full aspect-video rounded-2xl" />
          )}
        </div>
      )}

      <div className="px-4 py-6 space-y-4">
        {vis.name !== false && (
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div>
              <h2 className="text-2xl font-bold" data-testid={`text-ds-client-name-${client.id}`}>{client.name}</h2>
              {vis.genre !== false && client.genre && (
                <p className="text-sm text-muted-foreground">{client.genre}</p>
              )}
              {vis.timeSlot !== false && client.timeSlot && (
                <p className="text-xs text-muted-foreground mt-1">{client.timeSlot}</p>
              )}
            </div>
            <ShareButton title={client.name || "Client"} />
          </div>
        )}

        {vis.origin !== false && client.origin && (
          <div className="text-sm text-muted-foreground" data-testid={`text-ds-client-origin-${client.id}`}>
            Origin: {client.origin}
          </div>
        )}

        {vis.members !== false && members.length > 0 && (
          <div className="space-y-1" data-testid={`section-ds-client-members-${client.id}`}>
            <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Members</h3>
            <div className="flex flex-wrap gap-1">
              {members.map((m) => (
                <Badge key={m} variant="secondary" className="text-xs">{m}</Badge>
              ))}
            </div>
          </div>
        )}

        {vis.bio !== false && client.bio && (
          <div className="border-t pt-4">
            <p className="text-sm leading-relaxed" data-testid={`text-ds-client-bio-${client.id}`}>{client.bio}</p>
          </div>
        )}

        {vis.description !== false && client.description && (
          <div className="border-t pt-4">
            <p className="text-sm leading-relaxed" data-testid={`text-ds-client-description-${client.id}`}>
              {client.description}
            </p>
          </div>
        )}

        <div className="border-t pt-4 space-y-2">
          <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Contact</h3>
          {vis.email !== false && client.email && (
            <a href={`mailto:${client.email}`} className="flex items-center gap-2 text-sm hover-elevate rounded-md px-2 py-1.5" data-testid={`link-ds-client-email-${client.id}`}>
              <Mail className="w-4 h-4 text-muted-foreground" />
              {client.email}
            </a>
          )}
          {vis.phone !== false && client.phone && (
            <a href={`tel:${client.phone}`} className="flex items-center gap-2 text-sm hover-elevate rounded-md px-2 py-1.5" data-testid={`link-ds-client-phone-${client.id}`}>
              <Phone className="w-4 h-4 text-muted-foreground" />
              {client.phone}
            </a>
          )}
          {vis.website !== false && client.website && (
            <a href={client.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm hover-elevate rounded-md px-2 py-1.5" data-testid={`link-ds-client-website-${client.id}`}>
              <Globe className="w-4 h-4 text-muted-foreground" />
              {client.website}
            </a>
          )}
          {vis.socialLinks !== false && client.socialLinks && (
            <a href={client.socialLinks} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm hover-elevate rounded-md px-2 py-1.5" data-testid={`link-ds-client-social-${client.id}`}>
              <Globe className="w-4 h-4 text-muted-foreground" />
              {client.socialLinks}
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
                  data-testid={`link-ds-client-${l.key}-${client.id}`}
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
          {client.imageUrl2 ? (
            <img
              src={client.imageUrl2}
              alt={`${client.name} image 2`}
              className="w-full h-48 object-cover rounded-2xl shadow-md"
              data-testid={`img-ds-client-secondary-${client.id}`}
            />
          ) : (
            <ImagePlaceholder label="Client Image 2" className="w-full h-48 rounded-2xl" />
          )}
        </div>
      )}

      {vis.promoterImageUrl !== false && (
        <div className="w-full">
          {client.promoterImageUrl ? (
            <img
              src={client.promoterImageUrl}
              alt="Promoter"
              className="w-full h-32 object-cover rounded-2xl shadow-md"
              data-testid={`img-ds-client-promoter-${client.id}`}
            />
          ) : (
            <ImagePlaceholder label="Promoter Image" className="w-full h-32 rounded-2xl" />
          )}
        </div>
      )}
    </div>
  );
}

export default function DSPage() {
  const { get } = useSettings();

  const title = get("ds_page_title", "DS");
  const content = get("ds_content_text", "[ DS content area -- customisable ]");
  const image = get("ds_content_image");

  const { data: clients, isLoading } = useQuery<DsClient[]>({
    queryKey: ["/api/ds-clients"],
  });

  return (
    <AppLayout bgKey="bg_ds">
      <div className="px-4 py-4">
        <h2 className="text-lg font-semibold mb-4" data-testid="text-ds-title">{title}</h2>
        <div className="space-y-4">
          {image ? (
            <img src={image} alt={title} className="w-full h-48 object-cover rounded-2xl shadow-md" data-testid="img-ds-content" />
          ) : (
            <ImagePlaceholder label="DS Content" className="w-full h-48" />
          )}
          <p className="text-sm text-muted-foreground text-center" data-testid="text-ds-content">
            {content}
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="px-4 space-y-4">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : (
        clients && clients.length > 0 && (
          <div className="space-y-6 border-t mt-4">
            {clients.map((client) => (
              <ClientProfile key={client.id} client={client} />
            ))}
          </div>
        )
      )}
    </AppLayout>
  );
}
