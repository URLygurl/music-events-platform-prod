import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Share2, Copy, Check } from "lucide-react";
import { SiFacebook, SiX, SiWhatsapp, SiLinkedin } from "react-icons/si";
import { useToast } from "@/hooks/use-toast";

interface ShareButtonProps {
  title?: string;
  url?: string;
  description?: string;
  variant?: "ghost" | "outline" | "default";
  size?: "icon" | "sm" | "default";
}

export function ShareButton({
  title = "",
  url,
  description = "",
  variant = "ghost",
  size = "icon",
}: ShareButtonProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const shareUrl = url || (typeof window !== "undefined" ? window.location.href : "");
  const shareText = title || document?.title || "";

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast({ title: "Copied", description: "Link copied to clipboard." });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Error", description: "Could not copy link.", variant: "destructive" });
    }
  };

  const shareToFacebook = () => {
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
      "_blank",
      "width=600,height=400"
    );
  };

  const shareToTwitter = () => {
    window.open(
      `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`,
      "_blank",
      "width=600,height=400"
    );
  };

  const shareToWhatsApp = () => {
    window.open(
      `https://wa.me/?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`,
      "_blank"
    );
  };

  const shareToLinkedIn = () => {
    window.open(
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`,
      "_blank",
      "width=600,height=400"
    );
  };

  const nativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: shareText, text: description, url: shareUrl });
      } catch {}
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size={size} variant={variant} data-testid="button-share">
          <Share2 className="w-4 h-4" />
          {size !== "icon" && <span className="ml-1">Share</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={copyLink} data-testid="share-copy-link">
          {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
          {copied ? "Copied" : "Copy link"}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={shareToFacebook} data-testid="share-facebook">
          <SiFacebook className="w-4 h-4 mr-2" />
          Facebook
        </DropdownMenuItem>
        <DropdownMenuItem onClick={shareToTwitter} data-testid="share-twitter">
          <SiX className="w-4 h-4 mr-2" />
          X (Twitter)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={shareToWhatsApp} data-testid="share-whatsapp">
          <SiWhatsapp className="w-4 h-4 mr-2" />
          WhatsApp
        </DropdownMenuItem>
        <DropdownMenuItem onClick={shareToLinkedIn} data-testid="share-linkedin">
          <SiLinkedin className="w-4 h-4 mr-2" />
          LinkedIn
        </DropdownMenuItem>
        {typeof navigator !== "undefined" && "share" in navigator && (
          <DropdownMenuItem onClick={nativeShare} data-testid="share-native">
            <Share2 className="w-4 h-4 mr-2" />
            More...
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
