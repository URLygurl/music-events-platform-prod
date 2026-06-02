import { useQuery } from "@tanstack/react-query";
import type { SiteSetting } from "@shared/schema";

export function useSettings() {
  const { data: settings, isLoading } = useQuery<SiteSetting[]>({
    queryKey: ["/api/settings"],
  });

  const get = (key: string, fallback = ""): string => {
    const found = settings?.find((s) => s.key === key);
    return found?.value || fallback;
  };

  const getBySection = (section: string): SiteSetting[] => {
    return settings?.filter((s) => s.section === section) || [];
  };

  return { settings, isLoading, get, getBySection };
}
