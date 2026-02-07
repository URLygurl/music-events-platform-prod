import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/app-layout";
import { ImagePlaceholder } from "@/components/image-placeholder";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { CalendarDays, MapPin } from "lucide-react";
import type { Event } from "@shared/schema";

export default function EventsPage() {
  const { data: events, isLoading } = useQuery<Event[]>({
    queryKey: ["/api/events"],
  });

  return (
    <AppLayout>
      <div className="px-4 py-4">
        <h2 className="text-lg font-semibold mb-4" data-testid="text-events-title">Events</h2>

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
            events?.map((event) => (
              <Card key={event.id} className="overflow-visible" data-testid={`card-event-${event.id}`}>
                {event.imageUrl ? (
                  <img
                    src={event.imageUrl}
                    alt={event.name}
                    className="w-full h-40 object-cover rounded-t-md"
                  />
                ) : (
                  <ImagePlaceholder label="Event Image" className="w-full h-40 rounded-t-md rounded-b-none" />
                )}
                <div className="p-4 space-y-2">
                  <h3 className="font-semibold" data-testid={`text-event-name-${event.id}`}>{event.name}</h3>
                  {event.description && (
                    <p className="text-sm text-muted-foreground">{event.description}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    {event.date && (
                      <span className="flex items-center gap-1">
                        <CalendarDays className="w-3.5 h-3.5" />
                        {event.date}
                      </span>
                    )}
                    {event.venue && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" />
                        {event.venue}
                      </span>
                    )}
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
    </AppLayout>
  );
}
