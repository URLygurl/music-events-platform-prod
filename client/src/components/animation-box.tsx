import { useEffect, useRef, useState } from "react";
import { useSettings } from "@/hooks/use-settings";

interface AnimationBoxProps {
  text: string;
  style: string;
  backgroundImage?: string;
  className?: string;
}

const ANIMATION_STYLES: Record<string, string> = {
  "fade-in": "animate-fade-in",
  "slide-up": "animate-slide-up",
  "slide-left": "animate-slide-left",
  "slide-right": "animate-slide-right",
  "zoom-in": "animate-zoom-in",
  "bounce": "animate-bounce-in",
  "pulse": "animate-pulse-glow",
};

export function AnimationBox({ text, style, backgroundImage, className = "" }: AnimationBoxProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.unobserve(el);
        }
      },
      { threshold: 0.2 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const animClass = ANIMATION_STYLES[style] || ANIMATION_STYLES["fade-in"];

  return (
    <div
      ref={ref}
      className={`relative overflow-hidden rounded-2xl shadow-lg ${className}`}
      data-testid={`animation-box-${style}`}
    >
      {backgroundImage && (
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${backgroundImage})` }}
        />
      )}
      <div className={`absolute inset-0 ${backgroundImage ? "bg-black/50" : "bg-foreground/5"}`} />
      <div
        className={`relative z-10 flex items-center justify-center min-h-[120px] p-6 ${
          visible ? animClass : "opacity-0"
        }`}
      >
        <p className={`text-center text-lg font-semibold ${backgroundImage ? "text-white" : ""}`}>
          {text}
        </p>
      </div>
    </div>
  );
}

export function AnimationBoxes() {
  const { get } = useSettings();

  const boxes = [1, 2, 3]
    .map((n) => ({
      text: get(`anim_box_${n}_text`),
      style: get(`anim_box_${n}_style`, "fade-in"),
      bg: get(`anim_box_${n}_bg`),
    }))
    .filter((b) => b.text);

  if (boxes.length === 0) return null;

  return (
    <div className="space-y-4" data-testid="animation-boxes">
      {boxes.map((box, i) => (
        <AnimationBox
          key={i}
          text={box.text}
          style={box.style}
          backgroundImage={box.bg || undefined}
        />
      ))}
    </div>
  );
}
