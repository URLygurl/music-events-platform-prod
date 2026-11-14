import { ShieldCheck } from 'lucide-react';

/** Convenience link only: the legacy server still checks admin credentials. */
export function LegacyAdminLink() {
  return (
    <a href="/login?legacy=1" aria-label="Admin login" title="Admin login"
      className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      data-testid="legacy-admin-link">
      <ShieldCheck className="h-4 w-4" aria-hidden="true" />
    </a>
  );
}
