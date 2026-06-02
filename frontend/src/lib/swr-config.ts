import api from "@/services/api";

export const fetcher = (url: string) => api.get(url).then((res) => res.data);

export const SWR_CONFIG = {
  fetcher,
  revalidateOnFocus: false, // Don't re-fetch when switching tabs
  revalidateIfStale: false,  // Use cached data if available
  dedupingInterval: 60000,   // Cache for 1 minute
};
