import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";

const enquiryFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email required"),
  message: z.string().optional(),
});

type EnquiryFormValues = z.infer<typeof enquiryFormSchema>;

export function EnquiryForm({ title = "Enquire / Subscribe" }: { title?: string }) {
  const { toast } = useToast();
  const form = useForm<EnquiryFormValues>({
    resolver: zodResolver(enquiryFormSchema),
    defaultValues: { name: "", email: "", message: "" },
  });

  const mutation = useMutation({
    mutationFn: async (data: EnquiryFormValues) => {
      await apiRequest("POST", "/api/enquiries", data);
    },
    onSuccess: () => {
      toast({ title: "Sent", description: "Your enquiry has been submitted." });
      form.reset();
      queryClient.invalidateQueries({ queryKey: ["/api/enquiries"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to submit. Please try again.", variant: "destructive" });
    },
  });

  return (
    <div className="rounded-2xl border bg-background/80 backdrop-blur-sm p-5 shadow-lg">
      <h3 className="text-sm font-medium mb-4 uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      <Form {...form}>
        <form onSubmit={form.handleSubmit((d) => mutation.mutate(d))} className="space-y-3">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Name</FormLabel>
                <FormControl>
                  <Input {...field} data-testid="input-enquiry-name" />
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
                  <Input type="email" {...field} data-testid="input-enquiry-email" />
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
                <FormLabel className="text-xs">Message</FormLabel>
                <FormControl>
                  <Textarea {...field} value={field.value || ""} className="resize-none" rows={3} data-testid="input-enquiry-message" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" className="w-full" disabled={mutation.isPending} data-testid="button-submit-enquiry">
            {mutation.isPending ? "Sending..." : "Submit"}
          </Button>
        </form>
      </Form>
    </div>
  );
}
