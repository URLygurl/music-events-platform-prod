import { useState } from "react";
import { createAuthClient } from "better-auth/react";
import { magicLinkClient, emailOTPClient } from "better-auth/client/plugins";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const authClient = createAuthClient({
  basePath: "/api/better-auth",
  plugins: [magicLinkClient(), emailOTPClient()],
});

// The farm bearer credential is held by Nakedapp's backend. The browser only
// receives the existing HttpOnly app-session cookie, never set-auth-token.
const farmClient = createAuthClient({
  basePath: "/api/farm-auth",
  plugins: [magicLinkClient(), emailOTPClient()],
});

export function EmailLogin({ provider = "local", magicLinkEnabled = true }: {
  provider?: "local" | "farm"; magicLinkEnabled?: boolean;
}) {
  const client = provider === "farm" ? farmClient : authClient;
  const [email, setEmail] = useState("");
  const [method, setMethod] = useState<"link" | "code">(magicLinkEnabled ? "link" : "code");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(""); setMessage("");
    try {
      if (method === "code" && sent) {
        const result = await client.signIn.emailOtp({ email, otp: code });
        if (result.error) { setError("Code invalid or expired. Request a new code."); return; }
        window.location.assign(provider === "farm" ? "/profile" : "/");
      } else {
        const result = method === "link"
          ? await client.signIn.magicLink(provider === "farm" ? { email } : { email, callbackURL: "/", errorCallbackURL: "/login" })
          : await client.emailOtp.sendVerificationOtp({ email, type: "sign-in" });
        if (result.error) { setError("Unable to send. Please wait a minute and try again."); return; }
        setSent(true);
        setMessage(method === "link" ? "Check your email for a sign-in link. It expires in 5 minutes." : "Check your email for a 6-digit code. It expires in 5 minutes.");
      }
    } catch { setError("Could not connect. Please try again."); }
    finally { setBusy(false); }
  }
  function reset(next: "link" | "code") {
    setMethod(next); setSent(false); setCode(""); setError(""); setMessage("");
  }
  return (
    <div className="border-t pt-5 space-y-3" data-testid="email-login">
      <h2 className="text-sm font-semibold">Sign in with email</h2>
      <div className="flex gap-2">
        {magicLinkEnabled && <Button type="button" size="sm" variant={method === "link" ? "default" : "outline"} onClick={() => reset("link")} disabled={busy}>Magic link</Button>}
        <Button type="button" size="sm" variant={method === "code" ? "default" : "outline"} onClick={() => reset("code")} disabled={busy}>One-time code</Button>
      </div>
      <form onSubmit={submit} className="space-y-3">
        <Label htmlFor="signin-email">Email</Label>
        <Input id="signin-email" type="email" autoComplete="email" value={email} onChange={(e) => { setEmail(e.target.value); setSent(false); setCode(""); setMessage(""); }} required disabled={busy} />
        {method === "code" && sent && (
          <>
            <Label htmlFor="signin-code">6-digit sign-in code</Label>
            <Input id="signin-code" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} pattern="[0-9]{6}" required disabled={busy} />
          </>
        )}
        {message && <p className="text-xs" role="status">{message}</p>}
        {error && <p className="text-xs text-destructive" role="alert">{error}</p>}
        <Button type="submit" className="w-full" disabled={busy || !email || (method === "code" && sent && code.length !== 6)}>
          {busy ? "Please wait…" : method === "link" ? "Email me a sign-in link" : sent ? "Verify code and sign in" : "Email me a code"}
        </Button>
        {sent && method === "code" && <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => reset("code")}>Request a new code</Button>}
      </form>
    </div>
  );
}
