import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { AppLayout } from "@/components/app-layout";
import { ImagePlaceholder } from "@/components/image-placeholder";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { CalendarDays, MapPin, Clock } from "lucide-react";
import { useSettings } from "@/hooks/use-settings";
import type { Event } from "@shared/schema";
import { getVisibleFields, DEFAULT_EVENT_VISIBILITY } from "@shared/schema";

export default function EventsPage() {
  const { get } = useSettings();

  const { data: events, isLoading } = useQuery<Event[]>({
    queryKey: ["/api/events"],
  });

  const pageTitle = get("events_page_title", "Events");

  return (
    <AppLayout bgKey="bg_events">
      <div className="px-4 py-4">
        <h2 className="text-lg font-semibold mb-4" data-testid="text-events-title">{pageTitle}</h2>

        <div className="space-y-4">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="p-4 space-y-3">
                <Skeleton className="w-full h-32 rounded-md" />
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-4 w-full" />
              </Card>
            ))
          ) : events?.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No events yet
            </div>
          ) : (
            events?.map((event) => {
              const vis = getVisibleFields(event.visibleFields, DEFAULT_EVENT_VISIBILITY);
              return (
                <Link key={event.id} href={`/events/${event.id}`}>
                  <Card className="overflow-visible hover-elevate cursor-pointer" data-testid={`card-event-${event.id}`}>
                    {vis.imageUrl !== false && (
                      event.imageUrl ? (
                        <img
                          src={event.imageUrl}
                          alt={event.name}
                          className="w-full h-40 object-cover rounded-t-xl"
                        />
                      ) : (
                        <ImagePlaceholder label="Event Image" className="w-full h-40 rounded-t-xl rounded-b-none" />
                      )
                    )}
                    <div className="p-4 space-y-2">
                      <h3 className="font-semibold" data-testid={`text-event-name-${event.id}`}>{event.name}</h3>
                      {vis.description !== false && event.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">{event.description}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        {vis.date !== false && event.date && (
                          <span className="flex items-center gap-1">
                            <CalendarDays className="w-3.5 h-3.5" />
                            {event.date}
                          </span>
                        )}
                        {vis.time !== false && event.time && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {event.time}
                          </span>
                        )}
                        {vis.venue !== false && event.venue && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5" />
                            {event.venue}
                          </span>
                        )}
                      </div>
                    </div>
                  </Card>
                </Link>
              );
            })
          )}
        </div>
      </div>
    </AppLayout>
  );
}
