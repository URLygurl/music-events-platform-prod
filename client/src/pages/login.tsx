import { ImagePlaceholder } from "@/components/image-placeholder";
import { BottomNav } from "@/components/bottom-nav";
import { Button } from "@/components/ui/button";
import { LogIn } from "lucide-react";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="w-full border-b px-4 py-2">
        <p className="text-center text-xs tracking-widest uppercase text-muted-foreground">
          [ Company Name ]
        </p>
      </div>

      <div className="w-full border-b">
        <ImagePlaceholder label="Header Image" className="w-full h-14 rounded-none" />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-20 max-w-sm mx-auto w-full">
        <div className="w-full space-y-8">
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight">Welcome</h1>
            <p className="text-sm text-muted-foreground">
              Sign in to access the platform
            </p>
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
  );
}
