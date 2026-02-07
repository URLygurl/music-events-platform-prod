import { useSettings } from "@/hooks/use-settings";
import { Globe, Mail } from "lucide-react";
import {
  SiInstagram,
  SiFacebook,
  SiX,
  SiTiktok,
  SiYoutube,
  SiSoundcloud,
  SiSpotify,
  SiBandcamp,
} from "react-icons/si";

const SOCIAL_PLATFORMS = [
  { key: "social_instagram", icon: SiInstagram, label: "Instagram" },
  { key: "social_facebook", icon: SiFacebook, label: "Facebook" },
  { key: "social_twitter", icon: SiX, label: "X" },
  { key: "social_tiktok", icon: SiTiktok, label: "TikTok" },
  { key: "social_youtube", icon: SiYoutube, label: "YouTube" },
  { key: "social_soundcloud", icon: SiSoundcloud, label: "SoundCloud" },
  { key: "social_spotify", icon: SiSpotify, label: "Spotify" },
  { key: "social_bandcamp", icon: SiBandcamp, label: "Bandcamp" },
  { key: "social_website", icon: Globe, label: "Website" },
  { key: "social_email", icon: Mail, label: "Email" },
] as const;

interface SocialLinksProps {
  className?: string;
  iconSize?: string;
}

export function SocialLinks({ className = "", iconSize = "w-4 h-4" }: SocialLinksProps) {
  const { get } = useSettings();

  const activePlatforms = SOCIAL_PLATFORMS.filter((p) => {
    const val = get(p.key);
    return val && val.trim().length > 0;
  });

  if (activePlatforms.length === 0) return null;

  return (
    <div className={`flex items-center gap-3 flex-wrap ${className}`} data-testid="social-links">
      {activePlatforms.map((p) => {
        const val = get(p.key);
        const href = p.key === "social_email" ? `mailto:${val}` : val;
        const Icon = p.icon;
        return (
          <a
            key={p.key}
            href={href}
            target={p.key === "social_email" ? undefined : "_blank"}
            rel="noopener noreferrer"
            className="text-muted-foreground transition-colors hover:text-foreground"
            title={p.label}
            data-testid={`social-link-${p.key}`}
          >
            <Icon className={iconSize} />
          </a>
        );
      })}
    </div>
  );
}

export { SOCIAL_PLATFORMS };
