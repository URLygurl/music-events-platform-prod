import { ImagePlaceholder } from "@/components/image-placeholder";
import { BottomNav } from "@/components/bottom-nav";
import { Button } from "@/components/ui/button";
import { LogIn } from "lucide-react";
import { useSettings } from "@/hooks/use-settings";

export default function LoginPage() {
  const { get } = useSettings();

  const companyName = get("global_company_name", "[ Company Name ]");
  const welcomeText = get("login_welcome_text", "Welcome");
  const subtitle = get("login_subtitle", "Sign in to access the platform");
  const headerImage = get("login_header_image");
  const bgImage = get("bg_login");

  return (
    <div
      className="min-h-screen flex flex-col bg-background"
      style={bgImage ? {
        backgroundImage: `url(${bgImage})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      } : undefined}
    >
      {bgImage && <div className="fixed inset-0 bg-background/80 z-0" />}
      <div className={`flex flex-col min-h-screen ${bgImage ? "relative z-10" : ""}`}>
      <div className="w-full border-b px-4 py-2">
        <p className="text-center text-xs tracking-widest uppercase text-muted-foreground">
          {companyName}
        </p>
      </div>

      <div className="w-full border-b">
        {headerImage ? (
          <img src={headerImage} alt="Header" className="w-full h-14 object-cover" />
        ) : (
          <ImagePlaceholder label="Header Image" className="w-full h-14 rounded-none" />
        )}
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-20 max-w-sm mx-auto w-full">
        <div className="w-full space-y-8">
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight">{welcomeText}</h1>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          </div>

          <div className="space-y-3">
            <Button
              className="w-full"
              onClick={() => { window.location.href = "/api/login"; }}
              data-testid="button-login"
            >
              <LogIn className="w-4 h-4 mr-2" />
              Sign in with SSO
            </Button>
          </div>

          <p className="text-xs text-center text-muted-foreground">
            Sign in with Google, GitHub, Apple, or email
          </p>
        </div>
      </div>

      <BottomNav />
      </div>
    </div>
  );
}
