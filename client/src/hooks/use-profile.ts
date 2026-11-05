import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";

export type AccountProfile = {
  username: string | null; userType: string; avatarUrl: string | null; email: string | null;
  favourites: { id: number; name: string; imageUrl: string | null; price: number; currency: string }[];
  purchases: { id: number; amountTotal: number | null; currency: string | null; status: string | null; items: unknown; createdAt: string | null }[];
  tickets: { id: number; label: string; eventId: number | null; ticketReference: string | null; status: string; issuedAt: string }[];
};
export async function profileRequest(method: string, path: string, body?: unknown) {
  const multipart = body instanceof FormData;
  const response = await fetch(path, {
    method, credentials: "include",
    headers: body !== undefined && !multipart ? { "Content-Type": "application/json" } : {},
    body: body === undefined ? undefined : multipart ? body : JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Could not update your profile. Please try again.");
  return data;
}
export function localWishlist(): number[] {
  try {
    const data = JSON.parse(localStorage.getItem("mvt_wishlist") || "[]");
    return Array.isArray(data) ? Array.from(new Set<number>(data.filter((id) => Number.isSafeInteger(id) && id > 0))).slice(0, 500) : [];
  } catch { return []; }
}
export function useProfile() {
  const { user } = useAuth();
  const client = useQueryClient();
  // Include the authenticated identity in the cache key; never reuse another account's data.
  const queryKey = ["account-profile", user?.id];
  const query = useQuery<AccountProfile>({
    queryKey, enabled: !!user, staleTime: 0,
    queryFn: () => profileRequest("GET", "/api/profile"),
  });
  const refresh = async () => { await client.invalidateQueries({ queryKey }); };
  const favourite = useMutation({
    mutationFn: ({ id, remove }: { id: number; remove: boolean }) => profileRequest(
      remove ? "DELETE" : "POST", remove ? `/api/profile/favourites/${id}` : "/api/profile/favourites", remove ? undefined : { productId: id },
    ), onSuccess: refresh,
  });
  return { ...query, refresh, favourite };
}
