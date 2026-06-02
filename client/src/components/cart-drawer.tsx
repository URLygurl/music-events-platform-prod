import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ImagePlaceholder } from "@/components/image-placeholder";
import { useCart } from "@/hooks/use-cart";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  ShoppingCart,
  Plus,
  Minus,
  X,
  ExternalLink,
  CreditCard,
} from "lucide-react";

// ── Shared cart open state (module-level singleton) ──────────────────────────
// This lets any component open/close the cart drawer without prop drilling.

let _setCartOpen: ((v: boolean) => void) | null = null;

export function openCartDrawer() {
  _setCartOpen?.(true);
}

export function closeCartDrawer() {
  _setCartOpen?.(false);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatPrice(cents: number, currency = "nzd") {
  return new Intl.NumberFormat("en-NZ", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

// ── CartDrawer ────────────────────────────────────────────────────────────────

export function CartDrawer() {
  const { toast } = useToast();
  const { items: cart, removeItem, updateQty, total: cartTotal, count: cartCount, clearCart } = useCart();
  const [cartOpen, setCartOpen] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"stripe" | "paypal">("stripe");

  // Register the setter so openCartDrawer() / closeCartDrawer() work globally
  _setCartOpen = setCartOpen;

  const { data: stripeConfig } = useQuery<{ publishableKey: string | null }>({
    queryKey: ["/api/stripe/config"],
  });
  const stripeEnabled = !!stripeConfig?.publishableKey;

  const { data: paypalConfig } = useQuery<{ clientId: string | null }>({
    queryKey: ["/api/paypal/config"],
  });
  const paypalEnabled = !!paypalConfig?.clientId;

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      const checkoutItems = cart.map((i) => {
        const variantNote = i.selectedVariants
          ? Object.entries(i.selectedVariants).map(([k, v]) => `${k}: ${v}`).join(", ")
          : "";
        return {
          name: i.name + (variantNote ? ` (${variantNote})` : ""),
          imageUrl: i.imageUrl,
          price: i.price,
          currency: i.currency || "nzd",
          quantity: i.quantity,
        };
      });

      if (paymentMethod === "paypal") {
        const res = await apiRequest("POST", "/api/paypal/checkout", { items: checkoutItems });
        return res as unknown as { url: string };
      } else {
        const res = await apiRequest("POST", "/api/stripe/checkout", { items: checkoutItems });
        return res as unknown as { url: string; sessionId: string };
      }
    },
    onSuccess: (data) => {
      setRedirecting(true);
      window.location.href = data.url;
    },
    onError: (err: any) => {
      toast({
        title: "Checkout Error",
        description: err.message || "Failed to start checkout. Please try again.",
        variant: "destructive",
      });
    },
  });

  if (!cartOpen) {
    // Floating cart button — only shown when cart has items
    if (cartCount === 0) return null;
    return (
      <div className="fixed bottom-20 left-0 right-0 px-4 z-40">
        <Button
          className="w-full shadow-lg gap-2"
          onClick={() => setCartOpen(true)}
          data-testid="button-view-cart"
        >
          <ShoppingCart className="w-4 h-4" />
          View Cart ({cartCount} {cartCount === 1 ? "item" : "items"}) — {formatPrice(cartTotal)}
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => setCartOpen(false)}
      />

      {/* Drawer */}
      <div className="relative bg-background rounded-t-2xl max-h-[85vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-4 h-4" />
            <h3 className="font-semibold">Your Cart</h3>
            {cartCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                {cartCount}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {cartCount > 0 && (
              <Button
                size="sm"
                variant="ghost"
                className="text-xs text-muted-foreground h-7"
                onClick={() => { clearCart(); }}
              >
                Clear all
              </Button>
            )}
            <Button size="icon" variant="ghost" onClick={() => setCartOpen(false)}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {cart.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Your cart is empty
            </div>
          ) : (
            cart.map((item, idx) => (
              <div key={`${item.productId}-${idx}`} className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-muted">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <ImagePlaceholder label="" className="w-12 h-12" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.name}</p>
                  {item.selectedVariants && Object.keys(item.selectedVariants).length > 0 && (
                    <p className="text-xs text-muted-foreground truncate">
                      {Object.entries(item.selectedVariants)
                        .map(([k, v]) => `${k}: ${v}`)
                        .join(", ")}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {formatPrice(item.price, item.currency || "nzd")} each
                  </p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => updateQty(item.productId, -1, item.selectedVariants)}
                  >
                    <Minus className="w-3 h-3" />
                  </Button>
                  <span className="text-sm w-6 text-center">{item.quantity}</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => updateQty(item.productId, 1, item.selectedVariants)}
                  >
                    <Plus className="w-3 h-3" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-muted-foreground"
                    onClick={() => removeItem(item.productId, item.selectedVariants)}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {cart.length > 0 && (
          <div className="px-4 py-4 border-t space-y-3">
            {/* Total */}
            <div className="flex items-center justify-between">
              <span className="font-semibold">Total</span>
              <span className="font-semibold">{formatPrice(cartTotal)}</span>
            </div>

            {/* Payment method selector */}
            {(stripeEnabled || paypalEnabled) && (
              <div className="flex gap-2">
                {stripeEnabled && (
                  <button
                    onClick={() => setPaymentMethod("stripe")}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${
                      paymentMethod === "stripe"
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/50"
                    }`}
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    Card / Afterpay
                  </button>
                )}
                {paypalEnabled && (
                  <button
                    onClick={() => setPaymentMethod("paypal")}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${
                      paymentMethod === "paypal"
                        ? "border-[#003087] bg-[#003087]/5 text-[#003087]"
                        : "border-border text-muted-foreground hover:border-[#003087]/50"
                    }`}
                  >
                    <span className="font-bold text-[#003087]">Pay</span>
                    <span className="font-bold text-[#009cde]">Pal</span>
                  </button>
                )}
              </div>
            )}

            {/* Checkout button */}
            {stripeEnabled || paypalEnabled ? (
              <Button
                className="w-full gap-2"
                onClick={() => checkoutMutation.mutate()}
                disabled={checkoutMutation.isPending || redirecting}
                data-testid="button-checkout"
              >
                <ExternalLink className="w-4 h-4" />
                {redirecting
                  ? "Redirecting..."
                  : checkoutMutation.isPending
                  ? "Processing..."
                  : paymentMethod === "paypal"
                  ? "Checkout with PayPal →"
                  : "Checkout →"}
              </Button>
            ) : (
              <div className="text-center space-y-2">
                <p className="text-xs text-muted-foreground">
                  Payment is not configured yet. Contact the organiser to complete your purchase.
                </p>
                <Button variant="outline" className="w-full" onClick={() => setCartOpen(false)}>
                  Close
                </Button>
              </div>
            )}

            {stripeEnabled && paymentMethod === "stripe" && (
              <p className="text-xs text-center text-muted-foreground">
                Secure checkout · Visa · Mastercard · Afterpay · Apple Pay
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── CartButton ────────────────────────────────────────────────────────────────
// Drop-in button that shows cart count and opens the drawer on click.

export function CartButton({ className }: { className?: string }) {
  const { count: cartCount } = useCart();
  if (cartCount === 0) return null;
  return (
    <Button
      variant="outline"
      size="sm"
      className={`relative gap-2 ${className || ""}`}
      onClick={() => openCartDrawer()}
      data-testid="button-open-cart"
    >
      <ShoppingCart className="w-4 h-4" />
      <span>{cartCount}</span>
      <Badge className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs">
        {cartCount}
      </Badge>
    </Button>
  );
}
