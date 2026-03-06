/**
 * Stripe Integration — Hosted Checkout for products, tickets, and donations.
 *
 * The client pastes their own Stripe keys in the integrations panel.
 * Keys are stored in site_settings under the "integrations_stripe" section.
 * Falls back to STRIPE_SECRET_KEY env var if not set in DB.
 */
import Stripe from "stripe";
import { storage } from "./storage";

async function getStripeClient(): Promise<Stripe | null> {
  // Try DB first
  try {
    const settings = await storage.getAllSettings();
    const secretKey = settings.find((s: any) => s.key === "stripe_secret_key")?.value;
    if (secretKey && secretKey.startsWith("sk_")) {
      return new Stripe(secretKey, { apiVersion: "2024-06-20" });
    }
  } catch {}
  // Fall back to env var
  const envKey = process.env.STRIPE_SECRET_KEY;
  if (envKey && envKey.startsWith("sk_")) {
    return new Stripe(envKey, { apiVersion: "2024-06-20" });
  }
  return null;
}

export async function getStripePublishableKey(): Promise<string | null> {
  try {
    const settings = await storage.getAllSettings();
    const pubKey = settings.find((s: any) => s.key === "stripe_publishable_key")?.value;
    if (pubKey && pubKey.startsWith("pk_")) return pubKey;
  } catch {}
  return process.env.STRIPE_PUBLISHABLE_KEY || null;
}

export async function isStripeConnected(): Promise<boolean> {
  const stripe = await getStripeClient();
  return !!stripe;
}

export interface CartItem {
  productId: number;
  name: string;
  description?: string;
  imageUrl?: string;
  price: number; // in cents
  quantity: number;
  currency: string;
}

export async function createCheckoutSession(
  items: CartItem[],
  customerEmail: string | undefined,
  successUrl: string,
  cancelUrl: string,
  metadata?: Record<string, string>
): Promise<{ url: string; sessionId: string } | null> {
  const stripe = await getStripeClient();
  if (!stripe) return null;

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = items.map((item) => ({
    price_data: {
      currency: item.currency || "nzd",
      product_data: {
        name: item.name,
        description: item.description || undefined,
        images: item.imageUrl ? [item.imageUrl] : [],
      },
      unit_amount: item.price,
    },
    quantity: item.quantity,
  }));

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    line_items: lineItems,
    mode: "payment",
    customer_email: customerEmail,
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      ...metadata,
      items: JSON.stringify(items.map((i) => ({ productId: i.productId, name: i.name, qty: i.quantity, price: i.price }))),
    },
  });

  return { url: session.url!, sessionId: session.id };
}

export async function createDonationCheckoutSession(
  amount: number, // in cents
  currency: string,
  donorName: string,
  donorEmail: string,
  message: string | undefined,
  successUrl: string,
  cancelUrl: string
): Promise<{ url: string; sessionId: string } | null> {
  const stripe = await getStripeClient();
  if (!stripe) return null;

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: currency || "nzd",
          product_data: {
            name: "Donation",
            description: message ? `Message: ${message}` : "Thank you for your support!",
          },
          unit_amount: amount,
        },
        quantity: 1,
      },
    ],
    mode: "payment",
    customer_email: donorEmail,
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      type: "donation",
      donorName,
      donorEmail,
      message: message || "",
    },
  });

  return { url: session.url!, sessionId: session.id };
}

export async function handleWebhook(
  payload: Buffer,
  signature: string
): Promise<{ type: string; sessionId?: string; metadata?: Record<string, string>; amountTotal?: number; customerEmail?: string } | null> {
  const stripe = await getStripeClient();
  if (!stripe) return null;

  // Try to get webhook secret from DB or env
  let webhookSecret: string | undefined;
  try {
    const settings = await storage.getAllSettings();
    webhookSecret = settings.find((s: any) => s.key === "stripe_webhook_secret")?.value || process.env.STRIPE_WEBHOOK_SECRET;
  } catch {
    webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  }

  let event: Stripe.Event;
  if (webhookSecret) {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } else {
    // No webhook secret — parse raw (less secure, fine for dev)
    event = JSON.parse(payload.toString()) as Stripe.Event;
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    return {
      type: "checkout.session.completed",
      sessionId: session.id,
      metadata: session.metadata as Record<string, string>,
      amountTotal: session.amount_total || 0,
      customerEmail: session.customer_email || undefined,
    };
  }

  return { type: event.type };
}
