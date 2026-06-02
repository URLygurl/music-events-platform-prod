import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { AppLayout } from "@/components/app-layout";
import { SmartImage } from "@/components/smart-image";
import { ImagePlaceholder } from "@/components/image-placeholder";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { getVisibleFields } from "@shared/schema";
import type { Product } from "@shared/schema";
import { useCart } from "@/hooks/use-cart";
import { openCartDrawer } from "@/components/cart-drawer";
import {
  ShoppingCart,
  Heart,
  MessageSquare,
  ExternalLink,
  ChevronLeft,
  Check,
  Tag,
} from "lucide-react";

// ── Wishlist helpers (localStorage) ─────────────────────────────────────────

const WISHLIST_KEY = "mvt_wishlist";

function getWishlist(): number[] {
  try {
    return JSON.parse(localStorage.getItem(WISHLIST_KEY) || "[]");
  } catch {
    return [];
  }
}

function toggleWishlist(id: number): boolean {
  const list = getWishlist();
  const idx = list.indexOf(id);
  if (idx === -1) {
    list.push(id);
    localStorage.setItem(WISHLIST_KEY, JSON.stringify(list));
    return true; // added
  } else {
    list.splice(idx, 1);
    localStorage.setItem(WISHLIST_KEY, JSON.stringify(list));
    return false; // removed
  }
}

// ── Variant helpers ──────────────────────────────────────────────────────────

interface Variant {
  label: string;
  options: string[];
}

function parseVariants(visibleFields: string | null | undefined): Variant[] {
  const vf = getVisibleFields(visibleFields);
  const raw = vf["variants"];
  if (!raw || typeof raw !== "string") return [];
  try {
    return JSON.parse(raw) as Variant[];
  } catch {
    return [];
  }
}

// ── Component ────────────────────────────────────────────────────────────────

export default function ProductDetailPage() {
  const [, params] = useRoute("/shop/:id");
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const productId = params?.id ? parseInt(params.id) : null;

  const { data: product, isLoading } = useQuery<Product>({
    queryKey: [`/api/products/${productId}`],
    enabled: !!productId,
  });

  const { addItem, count: cartCount } = useCart();
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({});
  const [wishlisted, setWishlisted] = useState(false);
  const [showEnquiry, setShowEnquiry] = useState(false);
  const [enquiryText, setEnquiryText] = useState("");
  const [enquiryName, setEnquiryName] = useState("");
  const [enquiryEmail, setEnquiryEmail] = useState("");
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    if (productId) {
      setWishlisted(getWishlist().includes(productId));
    }
  }, [productId]);

  const { data: stripeConfig } = useQuery<{ publishableKey: string | null }>({
    queryKey: ["/api/stripe/config"],
  });
  const stripeEnabled = !!stripeConfig?.publishableKey;

  const enquiryMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/enquiries", {
        name: enquiryName,
        email: enquiryEmail,
        message: `Product enquiry: ${product?.name}\n\n${enquiryText}`,
      });
    },
    onSuccess: () => {
      toast({ title: "Enquiry sent!", description: "We'll be in touch soon." });
      setShowEnquiry(false);
      setEnquiryText("");
    },
    onError: () => {
      toast({ title: "Error", description: "Could not send enquiry.", variant: "destructive" });
    },
  });

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      if (!product) throw new Error("No product");
      const variantNote = Object.entries(selectedVariants)
        .map(([k, v]) => `${k}: ${v}`)
        .join(", ");
      const res = await apiRequest("POST", "/api/stripe/checkout", {
        items: [{
          name: product.name + (variantNote ? ` (${variantNote})` : ""),
          description: product.description || undefined,
          imageUrl: product.imageUrl || undefined,
          price: product.price,
          currency: product.currency || "nzd",
          quantity: 1,
        }],
      });
      return res as unknown as { url: string; sessionId: string };
    },
    onSuccess: (data) => {
      setRedirecting(true);
      window.location.href = data.url;
    },
    onError: (err: any) => {
      toast({ title: "Checkout Error", description: err.message, variant: "destructive" });
    },
  });

  const formatPrice = (cents: number, currency = "nzd") =>
    new Intl.NumberFormat("en-NZ", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(cents / 100);

  if (isLoading) {
    return (
      <AppLayout>
        <div className="px-4 py-4 space-y-4">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="w-full aspect-square rounded-2xl" />
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-20 w-full" />
        </div>
      </AppLayout>
    );
  }

  if (!product) {
    return (
      <AppLayout>
        <div className="px-4 py-12 text-center">
          <p className="text-sm text-muted-foreground">Product not found.</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate("/shop")}>
            Back to Shop
          </Button>
        </div>
      </AppLayout>
    );
  }

  const vf = getVisibleFields(product.visibleFields);
  const focal = (vf["imageFocal"] as unknown as string) || "center";
  const variants = parseVariants(product.visibleFields);
  const soldOut = product.stock != null && (product.stock as unknown as number) <= 0;
  const hasCartItems = cartCount > 0;

  const handleAddToCart = () => {
    // Validate all variants selected
    for (const v of variants) {
      if (!selectedVariants[v.label]) {
        toast({ title: "Select options", description: `Please choose a ${v.label}`, variant: "destructive" });
        return;
      }
    }
    addItem({
      productId: product.id,
      name: product.name,
      price: product.price,
      currency: product.currency || "nzd",
      imageUrl: product.imageUrl || undefined,
      quantity: 1,
      selectedVariants: Object.keys(selectedVariants).length > 0 ? selectedVariants : undefined,
    });
    toast({ title: "Added to cart", description: product.name });
  };

  const handleWishlist = () => {
    const added = toggleWishlist(product.id);
    setWishlisted(added);
    toast({ title: added ? "Added to wishlist" : "Removed from wishlist" });
  };

  return (
    <AppLayout>
      {/* Back button */}
      <div className="px-4 pt-4">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1 -ml-2 text-muted-foreground"
          onClick={() => navigate("/shop")}
          data-testid="button-back-to-shop"
        >
          <ChevronLeft className="w-4 h-4" />
          Shop
        </Button>
      </div>

      {/* Product image */}
      <div className="w-full aspect-square overflow-hidden">
        {product.imageUrl ? (
          <SmartImage
            src={product.imageUrl}
            alt={product.name}
            className="w-full h-full"
            focal={focal}
            data-testid="img-product-detail"
          />
        ) : (
          <ImagePlaceholder label={product.name} className="w-full aspect-square" />
        )}
      </div>

      <div className={`px-4 py-6 space-y-6 ${hasCartItems ? "pb-56" : "pb-32"}`}>
        {/* Title + wishlist */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold leading-tight" data-testid="text-product-name">
              {product.name}
            </h1>
            {product.category && product.category !== "general" && (
              <p className="text-sm text-muted-foreground capitalize mt-0.5">{product.category}</p>
            )}
          </div>
          <button
            onClick={handleWishlist}
            className="flex-shrink-0 w-10 h-10 rounded-full border flex items-center justify-center transition-colors hover:bg-muted"
            data-testid="button-wishlist"
            aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
          >
            <Heart
              className={`w-5 h-5 transition-colors ${wishlisted ? "fill-current text-foreground" : "text-muted-foreground"}`}
            />
          </button>
        </div>

        {/* Price */}
        <div className="flex items-center gap-3">
          <span className="text-3xl font-semibold" data-testid="text-product-price">
            {formatPrice(product.price, product.currency || "nzd")}
          </span>
          {soldOut && (
            <Badge variant="secondary">Sold Out</Badge>
          )}
          {product.stock !== null && product.stock !== undefined && product.stock > 0 && product.stock <= 5 && (
            <Badge variant="outline" className="text-xs">
              <Tag className="w-3 h-3 mr-1" />
              Only {product.stock} left
            </Badge>
          )}
        </div>

        {/* Description */}
        {product.description && (
          <div className="border-t pt-4">
            <p className="text-sm leading-relaxed text-muted-foreground" data-testid="text-product-description">
              {product.description}
            </p>
          </div>
        )}

        {/* Variants */}
        {variants.length > 0 && (
          <div className="space-y-4 border-t pt-4">
            {variants.map((variant) => (
              <div key={variant.label} className="space-y-2">
                <p className="text-sm font-medium">{variant.label}</p>
                <div className="flex flex-wrap gap-2">
                  {variant.options.map((opt) => (
                    <button
                      key={opt}
                      onClick={() => setSelectedVariants((prev) => ({ ...prev, [variant.label]: opt }))}
                      className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${
                        selectedVariants[variant.label] === opt
                          ? "bg-foreground text-background border-foreground"
                          : "bg-background hover:bg-muted border-border"
                      }`}
                      data-testid={`button-variant-${variant.label}-${opt}`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Enquiry form (collapsible) */}
        {showEnquiry && (
          <Card className="p-4 space-y-3">
            <h3 className="text-sm font-semibold">Enquire about this product</h3>
            <div className="space-y-2">
              <input
                className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                placeholder="Your name"
                value={enquiryName}
                onChange={(e) => setEnquiryName(e.target.value)}
                data-testid="input-enquiry-name"
              />
              <input
                className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                placeholder="Your email"
                type="email"
                value={enquiryEmail}
                onChange={(e) => setEnquiryEmail(e.target.value)}
                data-testid="input-enquiry-email"
              />
              <textarea
                className="w-full border rounded-md px-3 py-2 text-sm bg-background resize-none"
                placeholder={`Ask about ${product.name}...`}
                rows={3}
                value={enquiryText}
                onChange={(e) => setEnquiryText(e.target.value)}
                data-testid="input-enquiry-message"
              />
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => enquiryMutation.mutate()}
                disabled={enquiryMutation.isPending || !enquiryName || !enquiryEmail}
                data-testid="button-send-enquiry"
              >
                {enquiryMutation.isPending ? "Sending..." : "Send Enquiry"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowEnquiry(false)}>
                Cancel
              </Button>
            </div>
          </Card>
        )}
      </div>

      {/* Sticky action bar */}
      <div className={`fixed ${hasCartItems ? "bottom-32" : "bottom-16"} left-0 right-0 px-4 pb-4 z-40 bg-gradient-to-t from-background via-background/95 to-transparent pt-6 transition-[bottom] duration-200`}>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-shrink-0 gap-1"
            onClick={() => setShowEnquiry(!showEnquiry)}
            data-testid="button-enquire"
          >
            <MessageSquare className="w-4 h-4" />
            Enquire
          </Button>

          {!soldOut && (
            <>
              <Button
                variant="outline"
                className="flex-shrink-0 gap-1"
                onClick={handleAddToCart}
                data-testid="button-add-to-cart"
              >
                <ShoppingCart className="w-4 h-4" />
                Cart
              </Button>

              <Button
                variant="secondary"
                className="flex-shrink-0 gap-1"
                onClick={openCartDrawer}
                data-testid="button-go-to-cart"
              >
                <ShoppingCart className="w-4 h-4" />
                Go to Cart
              </Button>

              {stripeEnabled && (
                <Button
                  className="flex-1 gap-1"
                  onClick={() => checkoutMutation.mutate()}
                  disabled={checkoutMutation.isPending || redirecting}
                  data-testid="button-buy-now"
                >
                  <ExternalLink className="w-4 h-4" />
                  {redirecting ? "Redirecting..." : checkoutMutation.isPending ? "Processing..." : "Buy Now"}
                </Button>
              )}
            </>
          )}

          {soldOut && (
            <Button disabled className="flex-1">
              Sold Out
            </Button>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
