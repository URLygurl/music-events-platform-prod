import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AppLayout } from "@/components/app-layout";
import { SearchBar } from "@/components/search-bar";
import { ImagePlaceholder } from "@/components/image-placeholder";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useSettings } from "@/hooks/use-settings";
import { apiRequest } from "@/lib/queryClient";
import { ShoppingCart, Plus, Minus, X, ExternalLink, Check } from "lucide-react";
import type { Product } from "@shared/schema";

interface CartItem {
  product: Product;
  quantity: number;
}

export default function ShopPage() {
  const { toast } = useToast();
  const { get } = useSettings();
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  const pageTitle = get("shop_page_title", "Shop");
  const pageSubtitle = get("shop_page_subtitle", "");
  const emptyText = get("shop_page_empty_text", "No products available");

  // Check for success/cancel query params
  const params = new URLSearchParams(window.location.search);
  const isSuccess = params.get("success") === "1";
  const isCancelled = params.get("cancelled") === "1";

  const { data: products, isLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const { data: stripeConfig } = useQuery<{ publishableKey: string | null }>({
    queryKey: ["/api/stripe/config"],
  });
  const stripeEnabled = !!stripeConfig?.publishableKey;

  const filtered = search
    ? products?.filter((p) =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.description || "").toLowerCase().includes(search.toLowerCase()) ||
        (p.category || "").toLowerCase().includes(search.toLowerCase())
      )
    : products;

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
    toast({ title: "Added to cart", description: product.name });
  };

  const removeFromCart = (productId: number) => {
    setCart((prev) => prev.filter((i) => i.product.id !== productId));
  };

  const updateQty = (productId: number, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) =>
          i.product.id === productId ? { ...i, quantity: i.quantity + delta } : i
        )
        .filter((i) => i.quantity > 0)
    );
  };

  const cartTotal = cart.reduce((sum, i) => sum + i.product.price * i.quantity, 0);
  const cartCount = cart.reduce((sum, i) => sum + i.quantity, 0);

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      const items = cart.map((i) => ({
        name: i.product.name,
        description: i.product.description || undefined,
        imageUrl: i.product.imageUrl || undefined,
        price: i.product.price,
        currency: i.product.currency || "nzd",
        quantity: i.quantity,
      }));
      const res = await apiRequest("POST", "/api/stripe/checkout", { items });
      return res as { url: string; sessionId: string };
    },
    onSuccess: (data) => {
      setRedirecting(true);
      window.location.href = data.url;
    },
    onError: (err: any) => {
      toast({ title: "Checkout Error", description: err.message || "Failed to start checkout.", variant: "destructive" });
    },
  });

  const formatPrice = (cents: number, currency = "nzd") => {
    return new Intl.NumberFormat("en-NZ", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(cents / 100);
  };

  if (isSuccess) {
    return (
      <AppLayout>
        <div className="px-4 py-12 text-center space-y-4">
          <div className="w-16 h-16 rounded-full border-2 mx-auto flex items-center justify-center shadow-lg">
            <Check className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-semibold">Order Confirmed!</h2>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">
            Thank you for your purchase. You'll receive a confirmation email shortly.
          </p>
          <Button variant="outline" onClick={() => window.history.replaceState({}, "", "/shop")}>
            Continue Shopping
          </Button>
        </div>
      </AppLayout>
    );
  }

  if (isCancelled) {
    return (
      <AppLayout>
        <div className="px-4 py-12 text-center space-y-4">
          <h2 className="text-xl font-semibold">Order Cancelled</h2>
          <p className="text-sm text-muted-foreground">No payment was taken. Your cart is still saved.</p>
          <Button variant="outline" onClick={() => window.history.replaceState({}, "", "/shop")}>
            Back to Shop
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout bgKey="bg_shop">
      {/* Header */}
      <div className="px-4 py-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{pageTitle}</h2>
          {pageSubtitle && <p className="text-xs text-muted-foreground mt-0.5">{pageSubtitle}</p>}
        </div>
        {cartCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="relative gap-2"
            onClick={() => setCartOpen(true)}
            data-testid="button-open-cart"
          >
            <ShoppingCart className="w-4 h-4" />
            <span>{cartCount}</span>
            <Badge className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs">
              {cartCount}
            </Badge>
          </Button>
        )}
      </div>

      <div className="px-4 pb-4">
        <SearchBar value={search} onChange={setSearch} placeholder="Search products..." />
      </div>

      {/* Product Grid */}
      <div className="px-4 pb-24">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="w-full aspect-square rounded-xl" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        ) : filtered?.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            {emptyText}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filtered?.map((product) => (
              <Card key={product.id} className="overflow-hidden" data-testid={`card-product-${product.id}`}>
                <div className="aspect-square w-full overflow-hidden bg-muted">
                  {product.imageUrl ? (
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <ImagePlaceholder label="" className="w-full h-full" />
                  )}
                </div>
                <div className="p-3 space-y-2">
                  <div>
                    <p className="text-sm font-medium leading-tight">{product.name}</p>
                    {product.category && product.category !== "general" && (
                      <p className="text-xs text-muted-foreground capitalize">{product.category}</p>
                    )}
                    {product.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{product.description}</p>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold">
                      {formatPrice(product.price, product.currency || "nzd")}
                    </span>
                    {product.stock !== null && product.stock !== undefined && product.stock <= 0 ? (
                      <Badge variant="secondary" className="text-xs">Sold Out</Badge>
                    ) : (
                      <Button
                        size="sm"
                        className="h-7 text-xs px-2"
                        onClick={() => addToCart(product)}
                        data-testid={`button-add-to-cart-${product.id}`}
                      >
                        Add
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Floating Cart Button (when items in cart) */}
      {cartCount > 0 && !cartOpen && (
        <div className="fixed bottom-20 left-0 right-0 px-4 z-40">
          <Button
            className="w-full shadow-lg gap-2"
            onClick={() => setCartOpen(true)}
            data-testid="button-view-cart"
          >
            <ShoppingCart className="w-4 h-4" />
            View Cart ({cartCount} items) — {formatPrice(cartTotal)}
          </Button>
        </div>
      )}

      {/* Cart Drawer */}
      {cartOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/50" onClick={() => setCartOpen(false)} />
          <div className="relative bg-background rounded-t-2xl max-h-[80vh] flex flex-col">
            {/* Cart Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <h3 className="font-semibold">Your Cart</h3>
              <Button size="icon" variant="ghost" onClick={() => setCartOpen(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Cart Items */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {cart.map((item) => (
                <div key={item.product.id} className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-muted">
                    {item.product.imageUrl ? (
                      <img src={item.product.imageUrl} alt={item.product.name} className="w-full h-full object-cover" />
                    ) : (
                      <ImagePlaceholder label="" className="w-12 h-12" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.product.name}</p>
                    <p className="text-xs text-muted-foreground">{formatPrice(item.product.price, item.product.currency || "nzd")} each</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => updateQty(item.product.id, -1)}>
                      <Minus className="w-3 h-3" />
                    </Button>
                    <span className="text-sm w-6 text-center">{item.quantity}</span>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => updateQty(item.product.id, 1)}>
                      <Plus className="w-3 h-3" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground" onClick={() => removeFromCart(item.product.id)}>
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Cart Footer */}
            <div className="px-4 py-4 border-t space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold">Total</span>
                <span className="font-semibold">{formatPrice(cartTotal)}</span>
              </div>
              {stripeEnabled ? (
                <Button
                  className="w-full gap-2"
                  onClick={() => checkoutMutation.mutate()}
                  disabled={checkoutMutation.isPending || redirecting}
                  data-testid="button-checkout"
                >
                  <ExternalLink className="w-4 h-4" />
                  {redirecting ? "Redirecting to Stripe..." : checkoutMutation.isPending ? "Processing..." : "Checkout with Stripe →"}
                </Button>
              ) : (
                <div className="text-center space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Stripe is not configured. Contact the organiser to complete your purchase.
                  </p>
                  <Button variant="outline" className="w-full" onClick={() => setCartOpen(false)}>
                    Close
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
