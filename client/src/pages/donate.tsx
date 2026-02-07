import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Link } from "wouter";
import { AppLayout } from "@/components/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useSettings } from "@/hooks/use-settings";
import { useAuth } from "@/hooks/use-auth";
import { Heart, Check } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const donationSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email required"),
  amount: z.string().min(1, "Amount is required"),
  message: z.string().optional(),
});

type DonationFormValues = z.infer<typeof donationSchema>;

export default function DonatePage() {
  const { toast } = useToast();
  const { get } = useSettings();
  const { user, isAdmin, isLoading: authLoading } = useAuth();
  const [submitted, setSubmitted] = useState(false);
  const [selectedAmount, setSelectedAmount] = useState<string>("");

  const title = get("int_donations_title", "Support Our Mission");
  const description = get("int_donations_description", "Your support helps us keep the music alive.");
  const amountsStr = get("int_donations_amounts", "5,10,25,50,100");
  const amounts = amountsStr.split(",").map((a) => a.trim()).filter(Boolean);
  const form = useForm<DonationFormValues>({
    resolver: zodResolver(donationSchema),
    defaultValues: { name: "", email: "", amount: "", message: "" },
  });

  const mutation = useMutation({
    mutationFn: async (data: DonationFormValues) => {
      await apiRequest("POST", "/api/donations", data);
    },
    onSuccess: () => {
      setSubmitted(true);
      form.reset();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to submit. Please try again.", variant: "destructive" });
    },
  });

  const handleAmountSelect = (amt: string) => {
    setSelectedAmount(amt);
    form.setValue("amount", amt);
  };

  if (authLoading) {
    return (
      <AppLayout>
        <div className="px-4 py-8 max-w-lg mx-auto space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-40 w-full" />
        </div>
      </AppLayout>
    );
  }

  if (!isAdmin) {
    return (
      <AppLayout>
        <div className="px-4 py-12 flex items-center justify-center">
          <Card className="p-6 max-w-sm w-full text-center space-y-4">
            <Heart className="w-12 h-12 mx-auto text-muted-foreground" />
            <h2 className="text-lg font-semibold">Admin Access Required</h2>
            <p className="text-sm text-muted-foreground">
              {!user ? "Please log in with an admin account." : "You do not have admin access."}
            </p>
            {!user && (
              <Link href="/login">
                <Button data-testid="button-donate-login">Log In</Button>
              </Link>
            )}
          </Card>
        </div>
      </AppLayout>
    );
  }

  if (submitted) {
    return (
      <AppLayout>
        <div className="px-4 py-12 text-center space-y-4">
          <div className="w-16 h-16 rounded-full border-2 mx-auto flex items-center justify-center shadow-lg">
            <Check className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-semibold">Thank You</h2>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">
            Your donation has been recorded. We truly appreciate your support.
          </p>
          <Button variant="outline" onClick={() => setSubmitted(false)} data-testid="button-donate-again">
            Make Another Donation
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="px-4 py-6">
        <div className="text-center mb-6">
          <Heart className="w-8 h-8 mx-auto mb-2" />
          <h2 className="text-xl font-semibold" data-testid="text-donate-title">{title}</h2>
          <p className="text-sm text-muted-foreground mt-1" data-testid="text-donate-desc">{description}</p>
        </div>

        <div className="flex flex-wrap gap-2 justify-center mb-6">
          {amounts.map((amt) => (
            <button
              key={amt}
              onClick={() => handleAmountSelect(amt)}
              className={`px-4 py-2 rounded-xl border text-sm font-medium transition-colors ${
                selectedAmount === amt
                  ? "bg-foreground text-background border-foreground"
                  : "border-border hover-elevate"
              }`}
              data-testid={`button-amount-${amt}`}
            >
              ${amt}
            </button>
          ))}
        </div>

        <Card className="p-4 overflow-visible">
          <Form {...form}>
            <form onSubmit={form.handleSubmit((d) => mutation.mutate(d))} className="space-y-3">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Amount ($)</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Enter amount" data-testid="input-donate-amount" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Your Name</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-donate-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Email</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} data-testid="input-donate-email" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="message"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Message (optional)</FormLabel>
                    <FormControl>
                      <Textarea {...field} value={field.value || ""} className="resize-none" rows={3} data-testid="input-donate-message" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={mutation.isPending} data-testid="button-submit-donation">
                {mutation.isPending ? "Processing..." : "Donate"}
              </Button>
            </form>
          </Form>
        </Card>

        <p className="text-xs text-center text-muted-foreground mt-4">
          Donations are recorded securely. Payment processing will be available when Stripe is activated.
        </p>
      </div>
    </AppLayout>
  );
}
