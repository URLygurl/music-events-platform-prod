import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Camera, Heart, KeyRound, LogOut, Mail, ShoppingBag, Ticket, UserRound } from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { useAuth } from "@/hooks/use-auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import type { Product } from "@shared/schema";

// Membership type is display metadata, never an authorization role.
const USER_TYPES = {
  guest: { label: "Guest", color: "bg-slate-100 text-slate-800 border-slate-300" },
  audience: { label: "Audience", color: "bg-sky-100 text-sky-900 border-sky-300" },
  artist: { label: "Artist", color: "bg-violet-100 text-violet-900 border-violet-300" },
  advertiser: { label: "Advertiser", color: "bg-amber-100 text-amber-900 border-amber-300" },
  supplier: { label: "Supplier", color: "bg-emerald-100 text-emerald-900 border-emerald-300" },
  venue: { label: "Venue", color: "bg-rose-100 text-rose-900 border-rose-300" },
} as const;
function readWishlist(): number[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem("mvt_wishlist") || "[]");
    return Array.isArray(value) ? Array.from(new Set(value.filter((id): id is number => Number.isSafeInteger(id) && id > 0))) : [];
  } catch { return []; }
}

export default function ProfilePage() {
  const { user, isLoading, logout, isLoggingOut } = useAuth();
  const [username, setUsername] = useState("");
  const [avatar, setAvatar] = useState("");
  const [error, setError] = useState("");
  const [wishlist, setWishlist] = useState(readWishlist);
  const fileInput = useRef<HTMLInputElement>(null);
  const uploadVersion = useRef(0);
  const { data: products, isLoading: loadingProducts, isError: productsError } = useQuery<Product[]>({
    queryKey: ["/api/products"], enabled: !!user && wishlist.length > 0,
  });
  useEffect(() => { setUsername(user?.username || ""); setAvatar(""); setError(""); uploadVersion.current++; }, [user?.id, user?.username]);
  useEffect(() => {
    const refresh = () => setWishlist(readWishlist());
    window.addEventListener("storage", refresh); window.addEventListener("focus", refresh);
    return () => { window.removeEventListener("storage", refresh); window.removeEventListener("focus", refresh); uploadVersion.current++; };
  }, []);
  function previewAvatar(file?: File) {
    if (!file) return;
    const version = ++uploadVersion.current;
    setError("");
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setError("Choose a JPG, PNG or WebP image under 5 MB."); return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const src = String(reader.result);
      const image = new Image();
      image.onload = () => { if (version === uploadVersion.current) setAvatar(src); };
      image.onerror = () => { if (version === uploadVersion.current) setError("This image could not be opened."); };
      image.src = src;
    };
    reader.onerror = () => { if (version === uploadVersion.current) setError("Could not read this image."); };
    reader.readAsDataURL(file);
  }
  const membership = (user as (typeof user & { userType?: string }))?.userType;
  const type = membership && Object.prototype.hasOwnProperty.call(USER_TYPES, membership)
    ? membership as keyof typeof USER_TYPES : user ? "audience" : "guest";
  const pill = USER_TYPES[type];
  const name = username.trim() || [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "Your profile";
  const savedProducts = products?.filter((product) => wishlist.includes(product.id)) || [];
  const typePill = <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${pill.color}`} data-testid="profile-user-type">{pill.label}</span>;

  if (isLoading) return <AppLayout><div className="p-6 space-y-4"><Skeleton className="h-28" /><Skeleton className="h-64" /></div></AppLayout>;
  if (!user) return <AppLayout><div className="p-4 py-8"><Card className="p-6 text-center space-y-4">
    {typePill}<UserRound className="w-10 h-10 mx-auto text-muted-foreground" />
    <h1 className="text-xl font-semibold">Your profile</h1>
    <p className="text-sm text-muted-foreground">Sign in to access your profile, favourites, purchases and tickets.</p>
    <Link href="/login"><Button data-testid="button-sign-in">Sign in</Button></Link>
  </Card></div></AppLayout>;

  return <AppLayout><div className="px-4 py-6 space-y-5" data-testid="profile-page">
    <header className="space-y-3">{typePill}<h1 className="text-2xl font-semibold tracking-tight">My profile</h1><p className="text-sm text-muted-foreground">Your account, saved favourites and what’s next.</p></header>
    <Card className="p-5 space-y-5" data-testid="profile-details">
      <div className="flex items-center gap-4 min-w-0">
        <Avatar className="h-20 w-20 shrink-0"><AvatarImage src={avatar || user.profileImageUrl || undefined} alt="Your avatar" className="object-cover" /><AvatarFallback className="text-xl">{name.slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>
        <div className="min-w-0 space-y-2"><p className="font-semibold break-words" data-testid="text-profile-name">{name}</p>
          <Button variant="outline" size="sm" onClick={() => fileInput.current?.click()} data-testid="button-avatar-upload"><Camera className="w-4 h-4 mr-2" />Upload avatar</Button>
          <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label="Upload avatar image" data-testid="input-avatar" onChange={(e) => { previewAvatar(e.target.files?.[0]); e.target.value = ""; }} />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">JPG, PNG or WebP · Maximum 5 MB</p>
      {error && <p className="text-xs text-destructive" role="alert">{error}</p>}
      <div className="space-y-2"><Label htmlFor="profile-username">Username</Label><Input id="profile-username" value={username} maxLength={40} autoComplete="username" placeholder="Choose a username" onChange={(e) => setUsername(e.target.value)} data-testid="input-profile-username" aria-describedby="profile-preview-note" /></div>
      <div className="rounded-xl bg-muted/60 p-3 space-y-2"><p id="profile-preview-note" className="text-xs text-muted-foreground">Template preview only: username and avatar edits are not saved or uploaded to your account yet. They reset when you reload.</p><Button size="sm" disabled data-testid="button-profile-save">Save profile · Coming soon</Button></div>
    </Card>
    <Card className="p-5 space-y-4" data-testid="profile-account">
      <h2 className="font-semibold flex items-center gap-2"><KeyRound className="w-4 h-4" />Email & password</h2>
      <div className="space-y-2"><Label htmlFor="profile-email">Email address</Label><Input id="profile-email" type="email" value={user.email || ""} readOnly autoComplete="email" data-testid="text-profile-email" /></div>
      <Button variant="outline" size="sm" disabled><Mail className="w-4 h-4 mr-2" />Change email</Button>
      <div className="border-t pt-4 space-y-3"><p className="text-sm font-medium">Password</p><div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" disabled>Change password</Button><Button variant="outline" size="sm" disabled>Reset password</Button></div><p className="text-xs text-muted-foreground">Account change/reset options will be connected later. Magic links and one-time codes do not require a password.</p></div>
    </Card>
    <Card className="p-5 space-y-3" data-testid="profile-favourites">
      <h2 className="font-semibold flex items-center gap-2"><Heart className="w-4 h-4" />Wishlist / favourites</h2>
      <p className="text-xs text-muted-foreground">Shop favourites saved in this browser, not synced to your account yet. Use a private device for personal favourites.</p>
      {loadingProducts && wishlist.length > 0 ? <Skeleton className="h-16" /> : productsError ? <p className="text-sm text-muted-foreground">Could not load your favourites. Please try again later.</p> : savedProducts.length ? <ul className="divide-y">{savedProducts.map((product) => <li key={product.id} className="py-3"><Link href={`/shop/${product.id}`} className="text-sm font-medium break-words underline underline-offset-4">{product.name}</Link></li>)}</ul> : <p className="text-sm text-muted-foreground">{wishlist.length ? "Saved items are no longer available." : "Save something you love using the heart on a shop item."}</p>}
      <Link href="/shop"><Button variant="outline" size="sm">Browse the shop</Button></Link>
    </Card>
    <Card className="p-5 space-y-3" data-testid="profile-purchases"><h2 className="font-semibold flex items-center gap-2"><ShoppingBag className="w-4 h-4" />Purchases</h2><p className="text-sm text-muted-foreground">Your purchase history will appear here once account-linked orders are connected.</p><p className="text-xs text-muted-foreground">Coming soon · Orders, receipts and purchase details</p></Card>
    <Card className="p-5 space-y-3" data-testid="profile-tickets"><h2 className="font-semibold flex items-center gap-2"><Ticket className="w-4 h-4" />Tickets</h2><p className="text-sm text-muted-foreground">Your event tickets will appear here once ticketing is connected.</p><p className="text-xs text-muted-foreground">Coming soon · Upcoming events and ticket details</p><Link href="/events"><Button variant="outline" size="sm">Explore events</Button></Link></Card>
    <Button variant="outline" className="w-full" disabled={isLoggingOut} onClick={() => logout()} data-testid="button-profile-logout"><LogOut className="w-4 h-4 mr-2" />Log out</Button>
  </div></AppLayout>;
}
