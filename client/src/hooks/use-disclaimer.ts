import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./use-auth";

interface DisclaimerStatus {
  accepted: boolean;
  currentVersion: string;
  userVersion: string | null;
  acceptedAt: string | null;
}

async function fetchDisclaimerStatus(): Promise<DisclaimerStatus> {
  const res = await fetch("/api/disclaimer/status", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch disclaimer status");
  return res.json();
}

export function useDisclaimer() {
  const { isAuthenticated } = useAuth();

  const { data, isLoading } = useQuery<DisclaimerStatus>({
    queryKey: ["/api/disclaimer/status"],
    queryFn: fetchDisclaimerStatus,
    enabled: isAuthenticated,
    staleTime: 1000 * 60 * 5,
  });

  return {
    disclaimerAccepted: data?.accepted ?? false,
    isLoading,
    currentVersion: data?.currentVersion ?? null,
    userVersion: data?.userVersion ?? null,
    acceptedAt: data?.acceptedAt ?? null,
  };
}
