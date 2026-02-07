import { useEffect } from "react";
import { useSettings } from "@/hooks/use-settings";

export function CustomFontLoader() {
  const { get } = useSettings();
  const fontName = get("custom_font_name");
  const fontUrl = get("custom_font_url");

  useEffect(() => {
    if (!fontName || !fontUrl) return;

    const existingStyle = document.getElementById("custom-font-face");
    if (existingStyle) existingStyle.remove();

    const style = document.createElement("style");
    style.id = "custom-font-face";
    style.textContent = `
      @font-face {
        font-family: '${fontName}';
        src: url('${fontUrl}') format('${getFontFormat(fontUrl)}');
        font-display: swap;
      }
    `;
    document.head.appendChild(style);

    document.documentElement.style.setProperty("--font-custom", `'${fontName}', sans-serif`);

    return () => {
      const el = document.getElementById("custom-font-face");
      if (el) el.remove();
    };
  }, [fontName, fontUrl]);

  return null;
}

function getFontFormat(url: string): string {
  if (url.endsWith(".woff2")) return "woff2";
  if (url.endsWith(".woff")) return "woff";
  if (url.endsWith(".otf")) return "opentype";
  if (url.endsWith(".ttf")) return "truetype";
  return "truetype";
}
