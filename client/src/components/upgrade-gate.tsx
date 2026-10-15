/** Paid plans are discontinued. Keep existing feature usage callsites intact
 * while removing both upgrade prompts and subscription-based paywalls.
 * Server-side ownership, account and abuse safeguards still apply.
 */
interface UpgradeGateProps {
  children: React.ReactNode;
  feature?: "homes" | "activeTasks" | "docAnalyses" | "aiReports";
  minPlan?: "free" | "plus" | "premium";
  label?: string;
  inline?: boolean;
  className?: string;
}
export function UpgradeGate({ children }: UpgradeGateProps) {
  return <>{children}</>;
}
