/**
 * HlsPlayer
 *
 * A React component that plays an HLS stream using hls.js (for Chrome/Firefox/Android)
 * with a native <video> fallback for Safari/iOS which supports HLS natively.
 *
 * The stream URL should point to an m3u8 playlist served over HTTPS
 * (e.g. via the /stream/mvt/index.m3u8 server proxy).
 */

import { useEffect, useRef } from "react";

interface HlsPlayerProps {
  src: string;
  title?: string;
  className?: string;
}

export function HlsPlayer({ src, title, className }: HlsPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let hlsInstance: any = null;

    async function initPlayer() {
      // Safari supports HLS natively — use that directly
      if (video!.canPlayType("application/vnd.apple.mpegurl")) {
        video!.src = src;
        video!.play().catch(() => {
          // Autoplay blocked — user will tap play manually
        });
        return;
      }

      // All other browsers: use hls.js
      try {
        const Hls = (await import("hls.js")).default;
        if (!Hls.isSupported()) {
          console.warn("HLS not supported in this browser");
          return;
        }
        hlsInstance = new Hls({
          liveSyncDurationCount: 3,
          liveMaxLatencyDurationCount: 5,
        });
        hlsInstance.loadSource(src);
        hlsInstance.attachMedia(video!);
        hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
          video!.play().catch(() => {
            // Autoplay blocked — user will tap play manually
          });
        });
      } catch (err) {
        console.error("HLS player init error:", err);
      }
    }

    initPlayer();

    return () => {
      if (hlsInstance) {
        hlsInstance.destroy();
      }
    };
  }, [src]);

  return (
    <video
      ref={videoRef}
      controls
      playsInline
      muted={false}
      title={title}
      className={className || "w-full rounded-md bg-black"}
      data-testid="player-hls"
    />
  );
}
