import { AppLayout } from "@/components/app-layout";
import { ImagePlaceholder } from "@/components/image-placeholder";
import { useSettings } from "@/hooks/use-settings";

export default function DSPage() {
  const { get } = useSettings();

  const title = get("ds_page_title", "DS");
  const content = get("ds_content_text", "[ DS content area -- customisable ]");
  const image = get("ds_content_image");

  return (
    <AppLayout bgKey="bg_ds">
      <div className="px-4 py-4">
        <h2 className="text-lg font-semibold mb-4" data-testid="text-ds-title">{title}</h2>
        <div className="space-y-4">
          {image ? (
            <img src={image} alt={title} className="w-full h-48 object-cover rounded-md" data-testid="img-ds-content" />
          ) : (
            <ImagePlaceholder label="DS Content" className="w-full h-48" />
          )}
          <p className="text-sm text-muted-foreground text-center" data-testid="text-ds-content">
            {content}
          </p>
        </div>
      </div>
    </AppLayout>
  );
}
