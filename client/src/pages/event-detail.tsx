import { useQuery } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { AppLayout } from "@/components/app-layout";
import { ImagePlaceholder } from "@/components/image-placeholder";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CalendarDays, Clock, MapPin, Ticket, Globe } from "lucide-react";
import { ShareButton } from "@/components/share-button";
import type { Event } from "@shared/schema";
import { getVisibleFields, DEFAULT_EVENT_VISIBILITY } from "@shared/schema";

export default function EventDetailPage() {
  const [, params] = useRoute("/events/:id");
  const eventId = params?.id;

  const { data: event, isLoading } = useQuery<Event>({
    queryKey: ["/api/events", eventId],
    enabled: !!eventId,
  });

  if (isLoading) {
    return (
      <AppLayout showTopRibbon={false}>
        <div className="px-4 py-4 space-y-4">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="w-full h-48" />
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-20 w-full" />
        </div>
      </AppLayout>
    );
  }

  if (!event) {
    return (
      <AppLayout showTopRibbon={false}>
        <div className="px-4 py-12 text-center">
          <p className="text-muted-foreground">Event not found</p>
          <Link href="/events">
            <Button variant="ghost" className="mt-4" data-testid="button-back-to-events">
              Back to Events
            </Button>
          </Link>
        </div>
      </AppLayout>
    );
  }

  const vis = getVisibleFields(event.visibleFields, DEFAULT_EVENT_VISIBILITY);

  const googleMapsEmbedUrl = event.googleMapsUrl ? getGoogleMapsEmbed(event.googleMapsUrl) : null;

  return (
    <AppLayout showTopRibbon={false}>
      <div className="px-4 py-3 flex items-center gap-2">
        <Link href="/events">
          <Button size="icon" variant="ghost" data-testid="button-back">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <h1 className="text-sm font-medium flex-1 truncate">{event.name || "Event"}</h1>
        <ShareButton title={event.name} />
      </div>

      {vis.imageUrl !== false && (
        <div className="w-full">
          {event.imageUrl ? (
            <img
              src={event.imageUrl}
              alt={event.name}
              className="w-full h-48 object-cover"
              data-testid="img-event-hero"
            />
          ) : (
            <ImagePlaceholder label="Event Image" className="w-full h-48 rounded-none" />
          )}
        </div>
      )}

      <div className="px-4 py-6 space-y-4">
        {vis.name !== false && (
          <h1 className="text-2xl font-bold" data-testid="text-event-name">{event.name}</h1>
        )}

        {vis.description !== false && event.description && (
          <p className="text-sm leading-relaxed text-muted-foreground" data-testid="text-event-description">
            {event.description}
          </p>
        )}

        <div className="border-t pt-4 space-y-3">
          {vis.date !== false && event.date && (
            <div className="flex items-center gap-2 text-sm" data-testid="text-event-date">
              <CalendarDays className="w-4 h-4 text-muted-foreground" />
              <span>{event.date}</span>
            </div>
          )}

          {vis.time !== false && event.time && (
            <div className="flex items-center gap-2 text-sm" data-testid="text-event-time">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span>{event.time}</span>
            </div>
          )}

          {vis.endDate !== false && event.endDate && (
            <div className="flex items-center gap-2 text-sm" data-testid="text-event-end-date">
              <CalendarDays className="w-4 h-4 text-muted-foreground" />
              <span>Ends: {event.endDate}</span>
            </div>
          )}

          {vis.endTime !== false && event.endTime && (
            <div className="flex items-center gap-2 text-sm" data-testid="text-event-end-time">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span>Until: {event.endTime}</span>
            </div>
          )}

          {vis.venue !== false && event.venue && (
            <div className="flex items-center gap-2 text-sm" data-testid="text-event-venue">
              <MapPin className="w-4 h-4 text-muted-foreground" />
              <span>{event.venue}</span>
            </div>
          )}

          {vis.address !== false && event.address && (
            <div className="flex items-start gap-2 text-sm" data-testid="text-event-address">
              <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
              <span>{event.address}</span>
            </div>
          )}
        </div>

        {vis.ticketUrl !== false && event.ticketUrl && (
          <div className="pt-2">
            <a href={event.ticketUrl} target="_blank" rel="noopener noreferrer">
              <Button className="w-full" data-testid="button-tickets">
                <Ticket className="w-4 h-4 mr-2" /> Get Tickets
              </Button>
            </a>
          </div>
        )}

        {vis.googleMapsUrl !== false && event.googleMapsUrl && (
          <div className="border-t pt-4 space-y-2">
            <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Location</h3>
            {googleMapsEmbedUrl ? (
              <div className="w-full rounded-xl overflow-hidden border shadow-md">
                <iframe
                  src={googleMapsEmbedUrl}
                  width="100%"
                  height="250"
                  style={{ border: 0 }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  data-testid="iframe-google-maps"
                  title="Event Location"
                />
              </div>
            ) : (
              <a
                href={event.googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm hover-elevate rounded-md px-2 py-1.5"
                data-testid="link-google-maps"
              >
                <Globe className="w-4 h-4 text-muted-foreground" />
                View on Google Maps
              </a>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function getGoogleMapsEmbed(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("google.com") && url.includes("/maps/embed")) {
      return url;
    }
    if (parsed.hostname.includes("google.com") && url.includes("/maps/")) {
      const match = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
      if (match) {
        return `https://www.google.com/maps/embed?pb=!1m14!1m12!1m3!1d3000!2d${match[2]}!3d${match[1]}!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1`;
      }
    }
    if (parsed.hostname.includes("google.com") && parsed.searchParams.has("q")) {
      const q = parsed.searchParams.get("q");
      return `https://www.google.com/maps/embed/v1/place?key=&q=${encodeURIComponent(q || "")}`;
    }
    return null;
  } catch {
    return null;
  }
}
