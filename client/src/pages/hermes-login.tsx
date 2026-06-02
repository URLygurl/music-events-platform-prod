/**
 * HermesLoginPage — /hermes/login
 *
 * Superuser-only. Accepts the HERMES_SECRET env var value.
 * On success, stores the token in localStorage["hermes_token"]
 * and redirects to /hermes.
 *
 * Not linked anywhere in the public nav — only accessible by direct URL.
 * Admin users who visit /hermes are served the dashboard via session auth
 * and never need to see this page.
 */

import { useState } from "react";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Terminal, Loader2 } from "lucide-react";

export default function HermesLoginPage() {
  const [secret, setSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [loading, setLoading] = useState(false);
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!secret.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/hermes/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ secret: secret.trim() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Invalid secret" }));
        throw new Error(err.message || "Invalid secret");
      }
      const { token, expiresAt } = await res.json();
      localStorage.setItem("hermes_token", token);
      localStorage.setItem("hermes_token_exp", String(expiresAt));
      toast({ title: "Hermes connected", description: "Welcome, Superadmin." });
      navigate("/hermes");
    } catch (err: any) {
      toast({ title: "Access denied", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo / header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl border-2 border-foreground flex items-center justify-center mx-auto">
            <Terminal className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">Hermes</h1>
          <p className="text-sm text-muted-foreground">Backend operations dashboard</p>
        </div>

        <Card className="p-6">
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="hermes-secret" className="text-sm">
                Access Key
              </Label>
              <div className="relative">
                <Input
                  id="hermes-secret"
                  type={showSecret ? "text" : "password"}
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                  placeholder="Enter Hermes secret"
                  autoComplete="current-password"
                  className="pr-10"
                  data-testid="input-hermes-secret"
                />
                <button
                  type="button"
                  onClick={() => setShowSecret(!showSecret)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={loading || !secret.trim()}
              data-testid="button-hermes-login"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Connecting...
                </>
              ) : (
                "Connect to Hermes"
              )}
            </Button>
          </form>
        </Card>

        <p className="text-xs text-center text-muted-foreground">
          Superadmin access only. Set{" "}
          <code className="font-mono bg-muted px-1 rounded">HERMES_SECRET</code> in your Railway
          environment variables.
        </p>
      </div>
    </div>
  );
}
