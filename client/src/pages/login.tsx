import { useState } from "react";
import { ImagePlaceholder } from "@/components/image-placeholder";
import { BottomNav } from "@/components/bottom-nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogIn } from "lucide-react";
import { useSettings } from "@/hooks/use-settings";
import { useQueryClient } from "@tanstack/react-query";

export default function LoginPage() {
  const { get } = useSettings();
  const companyName = get("global_company_name", "[ Company Name ]");
  const welcomeText = get("login_welcome_text", "Welcome");
  const subtitle = get("login_subtitle", "Sign in to access the platform");
  const headerImage = get("login_header_image");
  const bgImage = get("bg_login");

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, password }),
      });
      if (res.ok) {
        await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
        window.location.href = "/";
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.message || "Invalid credentials");
      }
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  }

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
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              {error && (
                <p className="text-sm text-destructive text-center">{error}</p>
              )}
              <Button
                type="submit"
                className="w-full"
                disabled={loading}
                data-testid="button-login"
              >
                <LogIn className="w-4 h-4 mr-2" />
                {loading ? "Signing in…" : "Sign In"}
              </Button>
            </form>
          </div>
        </div>
        <BottomNav />
      </div>
    </div>
  );
}
