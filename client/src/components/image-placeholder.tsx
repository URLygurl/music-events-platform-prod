import { ImageIcon } from "lucide-react";

interface ImagePlaceholderProps {
  label?: string;
  className?: string;
  aspectRatio?: string;
}

export function ImagePlaceholder({
  label = "Image",
  className = "",
  aspectRatio,
}: ImagePlaceholderProps) {
  return (
    <div
      className={`border border-dashed border-muted-foreground/40 bg-muted/30 flex flex-col items-center justify-center gap-2 rounded-xl ${className}`}
      style={aspectRatio ? { aspectRatio } : undefined}
      data-testid={`placeholder-${label.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <ImageIcon className="w-6 h-6 text-muted-foreground/50" />
      <span className="text-xs text-muted-foreground/60">[ {label} ]</span>
    </div>
  );
}
