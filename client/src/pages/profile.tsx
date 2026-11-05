import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Camera, Heart, KeyRound, LogOut, Mail, ShoppingBag, Ticket, UserRound } from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { useAuth } from "@/hooks/use-auth";
import { useProfile, profileRequest, localWishlist } from "@/hooks/use-profile";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

const USER_TYPES = {
  guest: { label: "Guest", color: "bg-slate-100 text-slate-800 border-slate-300" },
  audience: { label: "Audience", color: "bg-sky-100 text-sky-900 border-sky-300" },
  artist: { label: "Artist", color: "bg-violet-100 text-violet-900 border-violet-300" },
  advertiser: { label: "Advertiser", color: "bg-amber-100 text-amber-900 border-amber-300" },
  supplier: { label: "Supplier", color: "bg-emerald-100 text-emerald-900 border-emerald-300" },
  venue: { label: "Venue", color: "bg-rose-100 text-rose-900 border-rose-300" },
} as const;
function money(amount: number | null, currency: string | null) {
  try { return new Intl.NumberFormat(undefined, { style: "currency", currency: (currency || "nzd").toUpperCase() }).format((amount || 0) / 100); }
  catch { return `${((amount || 0) / 100).toFixed(2)} ${(currency || "nzd").toUpperCase()}`; }
}
function itemNames(items: unknown) {
  try { const rows = typeof items === "string" ? JSON.parse(items) : items; return Array.isArray(rows) ? rows.map((item) => item && typeof item.name === "string" ? item.name : "Item").join(", ") : ""; }
  catch { return ""; }
}
export default function ProfilePage() {
  const { user, isLoading, logout, isLoggingOut } = useAuth();
  const { toast } = useToast();
  const profile = useProfile();
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [browserFavourites, setBrowserFavourites] = useState(localWishlist);
  const fileInput = useRef<HTMLInputElement>(null);
  const account = profile.data;
  useEffect(() => { setUsername(account?.username || ""); setError(""); }, [user?.id, account?.username]);
  const failed = (e: Error) => setError(e.message);
  const save = useMutation({
    mutationFn: () => profileRequest("PATCH", "/api/profile", { username: username.trim() }),
    onSuccess: async () => { setError(""); await profile.refresh(); toast({ title: "Profile saved" }); }, onError: failed,
  });
  const upload = useMutation({
    mutationFn: (file: File) => { const data = new FormData(); data.append("file", file); return profileRequest("POST", "/api/profile/avatar", data); },
    onSuccess: async () => { setError(""); await profile.refresh(); toast({ title: "Avatar saved" }); }, onError: failed,
  });
  const importFavourites = useMutation({
    mutationFn: () => profileRequest("POST", "/api/profile/favourites/import", { productIds: localWishlist() }),
    onSuccess: async () => {
      await profile.refresh(); setError("");
      try { localStorage.removeItem("mvt_wishlist"); } catch { /* Server save succeeded; browser storage is optional. */ }
      setBrowserFavourites([]); toast({ title: "Favourites saved to your account" });
    }, onError: failed,
  });
  const busy = save.isPending || upload.isPending;
  function uploadAvatar(file?: File) {
    if (!file) return;
    setError("");
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setError("Choose a JPG, PNG or WebP image under 5 MB."); return;
    }
    upload.mutate(file);
  }
  const membership = account?.userType;
  const type = membership && Object.prototype.hasOwnProperty.call(USER_TYPES, membership)
    ? membership as keyof typeof USER_TYPES : user ? "audience" : "guest";
  const pill = USER_TYPES[type];
  const name = username.trim() || [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "Your profile";
  const typePill = <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${pill.color}`} data-testid="profile-user-type">{pill.label}</span>;
  if (isLoading) return <AppLayout><div className="p-6 space-y-4"><Skeleton className="h-28" /><Skeleton className="h-64" /></div></AppLayout>;
  if (!user) return <AppLayout><div className="p-4 py-8"><Card className="p-6 text-center space-y-4">
    {typePill}<UserRound className="w-10 h-10 mx-auto text-muted-foreground" /><h1 className="text-xl font-semibold">Your profile</h1>
    <p className="text-sm text-muted-foreground">Sign in to access your profile, favourites, purchases and tickets.</p><Link href="/login"><Button data-testid="button-sign-in">Sign in</Button></Link>
  </Card></div></AppLayout>;
  if (profile.isLoading) return <AppLayout><div className="p-6 space-y-4"><Skeleton className="h-28" /><Skeleton className="h-64" /></div></AppLayout>;
  if (profile.isError || !account) return <AppLayout><Card className="m-4 p-5 space-y-3"><h1 className="font-semibold">Could not load your profile</h1><p className="text-sm text-muted-foreground">Please try again. Your account has not been changed.</p><Button onClick={() => profile.refetch()}>Try again</Button></Card></AppLayout>;
  return <AppLayout><div className="px-4 py-6 space-y-5" data-testid="profile-page">
    <header className="space-y-3">{typePill}<h1 className="text-2xl font-semibold tracking-tight">My profile</h1><p className="text-sm text-muted-foreground">Your account, saved favourites and what’s next.</p></header>
    {error && <p className="rounded-xl border p-3 text-sm text-destructive" role="alert">{error}</p>}
    <Card className="p-5 space-y-5" data-testid="profile-details">
      <div className="flex items-center gap-4 min-w-0"><Avatar className="h-20 w-20 shrink-0"><AvatarImage src={account.avatarUrl || user.profileImageUrl || undefined} alt="Your avatar" className="object-cover" /><AvatarFallback className="text-xl">{name.slice(0, 2).toUpperCase()}</AvatarFallback></Avatar><div className="min-w-0 space-y-2"><p className="font-semibold break-words" data-testid="text-profile-name">{name}</p><Button variant="outline" size="sm" disabled={busy} onClick={() => fileInput.current?.click()} data-testid="button-avatar-upload"><Camera className="w-4 h-4 mr-2" />{upload.isPending ? "Uploading…" : "Upload avatar"}</Button><input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label="Upload avatar image" data-testid="input-avatar" disabled={busy} onChange={(e) => { uploadAvatar(e.target.files?.[0]); e.target.value = ""; }} /></div></div>
      <p className="text-xs text-muted-foreground">JPG, PNG or WebP · Maximum 5 MB · Avatar uploads save immediately.</p>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); setError(""); save.mutate(); }}><div className="space-y-2"><Label htmlFor="profile-username">Username</Label><Input id="profile-username" value={username} minLength={3} maxLength={40} pattern="[A-Za-z0-9_.\-]{3,40}" autoComplete="nickname" placeholder="Choose a username" disabled={busy} required onChange={(e) => setUsername(e.target.value)} data-testid="input-profile-username" /></div><p className="text-xs text-muted-foreground">3–40 letters, numbers, dots, dashes or underscores. This display username does not change your existing login credentials.</p><Button type="submit" size="sm" disabled={busy || !username.trim()} data-testid="button-profile-save">{save.isPending ? "Saving…" : "Save profile"}</Button></form>
    </Card>
    <Card className="p-5 space-y-4" data-testid="profile-account"><h2 className="font-semibold flex items-center gap-2"><KeyRound className="w-4 h-4" />Email & password</h2><div className="space-y-2"><Label htmlFor="profile-email">Email address</Label><Input id="profile-email" type="email" value={account.email || ""} readOnly autoComplete="email" data-testid="text-profile-email" /></div><Button variant="outline" size="sm" disabled><Mail className="w-4 h-4 mr-2" />Change email</Button><div className="border-t pt-4 space-y-3"><p className="text-sm font-medium">Password</p><div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" disabled>Change password</Button><Button variant="outline" size="sm" disabled>Reset password</Button></div><p className="text-xs text-muted-foreground">Email/password changes require a separate verified authentication flow and are not edited through the profile table. Magic links and one-time codes do not require a password.</p></div></Card>
    <Card className="p-5 space-y-3" data-testid="profile-favourites"><h2 className="font-semibold flex items-center gap-2"><Heart className="w-4 h-4" />Wishlist / favourites</h2><p className="text-xs text-muted-foreground">Saved to your account and available across devices.</p>
      {browserFavourites.length > 0 && <div className="rounded-xl bg-muted/60 p-3 space-y-2"><p className="text-xs">This browser has older favourites. Only import them if they belong to you.</p><Button size="sm" variant="outline" disabled={importFavourites.isPending} onClick={() => importFavourites.mutate()} data-testid="button-import-favourites">Import this browser’s favourites</Button></div>}
      {account.favourites.length ? <ul className="divide-y">{account.favourites.map((product) => <li key={product.id} className="flex items-center justify-between gap-3 py-3"><Link href={`/shop/${product.id}`} className="text-sm font-medium break-words underline underline-offset-4 min-w-0">{product.name}</Link><Button size="sm" variant="ghost" className="shrink-0" disabled={profile.favourite.isPending} onClick={() => profile.favourite.mutate({ id: product.id, remove: true }, { onError: failed })} aria-label={`Remove ${product.name} from favourites`}>Remove</Button></li>)}</ul> : <p className="text-sm text-muted-foreground">Save something you love using the heart on a shop item.</p>}<Link href="/shop"><Button variant="outline" size="sm">Browse the shop</Button></Link>
    </Card>
    <Card className="p-5 space-y-3" data-testid="profile-purchases"><h2 className="font-semibold flex items-center gap-2"><ShoppingBag className="w-4 h-4" />Purchases</h2>{account.purchases.length ? <ul className="divide-y">{account.purchases.map((order) => <li key={order.id} className="py-3 space-y-1 text-sm"><p className="font-medium">Order #{order.id} · {money(order.amountTotal, order.currency)}</p><p className="break-words">{itemNames(order.items)}</p><p className="text-xs text-muted-foreground">{order.status || "pending"}{order.createdAt ? ` · ${new Date(order.createdAt).toLocaleDateString()}` : ""}</p></li>)}</ul> : <p className="text-sm text-muted-foreground">No purchases linked to your account yet. Check out while signed in to save new orders here.</p>}</Card>
    <Card className="p-5 space-y-3" data-testid="profile-tickets"><h2 className="font-semibold flex items-center gap-2"><Ticket className="w-4 h-4" />Tickets</h2>{account.tickets.length ? <ul className="divide-y">{account.tickets.map((ticket) => <li key={ticket.id} className="py-3 space-y-1 text-sm"><p className="font-medium break-words">{ticket.label}</p>{ticket.ticketReference && <p className="break-all">Reference: {ticket.ticketReference}</p>}<p className="text-xs text-muted-foreground">{ticket.status} · {new Date(ticket.issuedAt).toLocaleDateString()}</p>{ticket.eventId && <Link href={`/events/${ticket.eventId}`} className="underline text-xs">View event</Link>}</li>)}</ul> : <p className="text-sm text-muted-foreground">No tickets linked to your account yet. Ticket issuing and QR validation will be connected separately.</p>}<Link href="/events"><Button variant="outline" size="sm">Explore events</Button></Link></Card>
    <Button variant="outline" className="w-full" disabled={isLoggingOut} onClick={() => logout()} data-testid="button-profile-logout"><LogOut className="w-4 h-4 mr-2" />Log out</Button>
  </div></AppLayout>;
}
