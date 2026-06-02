/**
 * SmartImage — drop-in replacement for <img> in cards.
 * Renders with object-cover and a configurable focal point.
 */

import { useRef, useState, useCallback } from "react";

interface SmartImageProps {
  src: string;
  alt: string;
  className?: string;
  focal?: string;
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

const QUICK_POINTS = [
  { label: "↖", value: "0% 0%" },
  { label: "↑", value: "50% 0%" },
  { label: "↗", value: "100% 0%" },
  { label: "←", value: "0% 50%" },
  { label: "●", value: "50% 50%" },
  { label: "→", value: "100% 50%" },
  { label: "↙", value: "0% 100%" },
  { label: "↓", value: "50% 100%" },
  { label: "↘", value: "100% 100%" },
];

function parseFocal(value: string): { x: number; y: number } {
  const named: Record<string, { x: number; y: number }> = {
    "center": { x: 50, y: 50 },
    "top": { x: 50, y: 0 },
    "bottom": { x: 50, y: 100 },
    "left": { x: 0, y: 50 },
    "right": { x: 100, y: 50 },
    "top left": { x: 0, y: 0 },
    "top center": { x: 50, y: 0 },
    "top right": { x: 100, y: 0 },
    "center left": { x: 0, y: 50 },
    "center right": { x: 100, y: 50 },
    "bottom left": { x: 0, y: 100 },
    "bottom center": { x: 50, y: 100 },
    "bottom right": { x: 100, y: 100 },
  };
  if (named[value]) return named[value];
  const parts = value.trim().split(/\s+/);
  const x = parseFloat(parts[0]) || 50;
  const y = parseFloat(parts[1]) || 50;
  return { x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) };
}

interface FocalPointPickerProps {
  value: string;
  onChange: (value: string) => void;
  previewSrc?: string;
}

export function FocalPointPicker({ value, onChange, previewSrc }: FocalPointPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const focal = parseFocal(value || "center");

  const getPos = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const el = containerRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    const x = Math.max(0, Math.min(100, Math.round(((clientX - rect.left) / rect.width) * 100)));
    const y = Math.max(0, Math.min(100, Math.round(((clientY - rect.top) / rect.height) * 100)));
    return { x, y };
  }, []);

  const applyPos = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const pos = getPos(e);
    if (pos) onChange(`${pos.x}% ${pos.y}%`);
  }, [getPos, onChange]);

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground font-medium">
        Focal point — click or drag on the image to set where it anchors when cropped
      </p>

      {previewSrc ? (
        <div className="space-y-2">
          <div
            ref={containerRef}
            className="relative w-full rounded-lg overflow-hidden border bg-muted cursor-crosshair select-none"
            style={{ height: "180px" }}
            onMouseDown={(e) => { setIsDragging(true); applyPos(e); }}
            onMouseMove={(e) => { if (isDragging) applyPos(e); }}
            onMouseUp={() => setIsDragging(false)}
            onMouseLeave={() => setIsDragging(false)}
            onTouchStart={(e) => { setIsDragging(true); applyPos(e); }}
            onTouchMove={(e) => { if (isDragging) applyPos(e); }}
            onTouchEnd={() => setIsDragging(false)}
          >
            <img
              src={previewSrc}
              alt="focal editor"
              className="w-full h-full object-cover pointer-events-none"
              style={{ objectPosition: `${focal.x}% ${focal.y}%` }}
              draggable={false}
            />
            <div
              className="absolute pointer-events-none"
              style={{ left: `${focal.x}%`, top: `${focal.y}%`, transform: "translate(-50%, -50%)" }}
            >
              <div className="w-7 h-7 rounded-full border-2 border-white shadow-lg flex items-center justify-center" style={{ background: "rgba(0,0,0,0.45)" }}>
                <div className="w-1.5 h-1.5 rounded-full bg-white" />
              </div>
            </div>
            <div className="absolute bottom-1.5 right-1.5 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded pointer-events-none font-mono">
              {focal.x}% {focal.y}%
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">Crop preview:</span>
            <div className="w-14 h-14 rounded-lg overflow-hidden border bg-muted flex-shrink-0">
              <img src={previewSrc} alt="square" className="w-full h-full object-cover" style={{ objectPosition: `${focal.x}% ${focal.y}%` }} />
            </div>
            <div className="w-24 h-10 rounded overflow-hidden border bg-muted flex-shrink-0">
              <img src={previewSrc} alt="banner" className="w-full h-full object-cover" style={{ objectPosition: `${focal.x}% ${focal.y}%` }} />
            </div>
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground italic">Upload an image above to enable the focal point editor.</p>
      )}

      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Quick:</span>
        <div className="grid grid-cols-9 gap-0.5">
          {QUICK_POINTS.map((fp) => (
            <button
              key={fp.value}
              type="button"
              title={fp.value}
              onClick={() => onChange(fp.value)}
              className={`h-6 w-6 rounded text-xs flex items-center justify-center transition-colors ${
                value === fp.value ? "bg-foreground text-background" : "bg-muted hover:bg-muted-foreground/20 text-muted-foreground"
              }`}
            >
              {fp.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
