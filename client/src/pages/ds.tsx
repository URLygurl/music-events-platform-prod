import { AppLayout } from "@/components/app-layout";
import { ImagePlaceholder } from "@/components/image-placeholder";

export default function DSPage() {
  return (
    <AppLayout>
      <div className="px-4 py-4">
        <h2 className="text-lg font-semibold mb-4" data-testid="text-ds-title">DS</h2>
        <div className="space-y-4">
          <ImagePlaceholder label="DS Content" className="w-full h-48" />
          <p className="text-sm text-muted-foreground text-center">
            [ DS content area — customisable ]
          </p>
        </div>
      </div>
    </AppLayout>
  );
}
