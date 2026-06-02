/**
 * SmartImage — drop-in replacement for <img> in cards.
 * Renders with object-cover and a configurable focal point so portrait
 * images don't lose their subject when cropped into square/landscape slots.
 *
 * focal prop accepts CSS object-position values:
 *   "top" | "center" | "bottom" | "left" | "right"
 *   or any valid CSS value like "50% 20%"
 *
 * Default is "center" which matches the current behaviour.
 */

interface SmartImageProps {
  src: string;
  alt: string;
  className?: string;
  focal?: string; // CSS object-position value
  "data-testid"?: string;
}

export function SmartImage({ src, alt, className = "", focal = "center", "data-testid": testId }: SmartImageProps) {
  return (
    <img
      src={src}
      alt={alt}
      className={`object-cover ${className}`}
      style={{ objectPosition: focal }}
      data-testid={testId}
    />
  );
}

/**
 * FocalPointPicker — 3×3 grid of buttons for the admin to choose focal point.
 * Returns a CSS object-position string.
 */

const FOCAL_POINTS = [
  { label: "↖", value: "top left" },
  { label: "↑", value: "top center" },
  { label: "↗", value: "top right" },
  { label: "←", value: "center left" },
  { label: "●", value: "center" },
  { label: "→", value: "center right" },
  { label: "↙", value: "bottom left" },
  { label: "↓", value: "bottom center" },
  { label: "↘", value: "bottom right" },
];

interface FocalPointPickerProps {
  value: string;
  onChange: (value: string) => void;
  previewSrc?: string;
}

export function FocalPointPicker({ value, onChange, previewSrc }: FocalPointPickerProps) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">Image focal point (where to crop from)</p>
      <div className="flex gap-3 items-start">
        {/* 3×3 grid */}
        <div className="grid grid-cols-3 gap-0.5 w-20 flex-shrink-0">
          {FOCAL_POINTS.map((fp) => (
            <button
              key={fp.value}
              type="button"
              title={fp.value}
              onClick={() => onChange(fp.value)}
              className={`h-6 w-full rounded text-xs flex items-center justify-center transition-colors
                ${value === fp.value
                  ? "bg-foreground text-background"
                  : "bg-muted hover:bg-muted-foreground/20 text-muted-foreground"
                }`}
            >
              {fp.label}
            </button>
          ))}
        </div>
        {/* Live preview */}
        {previewSrc && (
          <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 border bg-muted">
            <img
              src={previewSrc}
              alt="preview"
              className="w-full h-full object-cover"
              style={{ objectPosition: value }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
