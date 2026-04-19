import { type HomeInsight } from "@/lib/api";

function scoreColor(score: number): string {
  if (score >= 80) return "#22c55e"; // green-500
  if (score >= 60) return "#f59e0b"; // amber-500
  if (score >= 40) return "#f97316"; // orange-500
  return "#ef4444"; // red-500
}

function scoreLabel(score: number): string {
  if (score >= 80) return "Healthy";
  if (score >= 60) return "Good";
  if (score >= 40) return "Needs Attention";
  return "At Risk";
}

export function HealthScoreRing({ insight }: { insight: HomeInsight }) {
  const score = insight.overallHealthScore;
  const color = scoreColor(score);
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-48 h-48">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 180 180">
          <circle cx="90" cy="90" r={radius} fill="none" stroke="currentColor" strokeWidth="10" className="text-muted/20" />
          <circle cx="90" cy="90" r={radius} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
            strokeDasharray={circumference} strokeDashoffset={circumference - progress}
            style={{ transition: "stroke-dashoffset 1s ease-out" }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-4xl font-bold font-heading" style={{ color }}>{score}</span>
          <span className="text-sm text-muted-foreground">{scoreLabel(score)}</span>
        </div>
      </div>
      <p className="text-sm text-muted-foreground text-center max-w-md">{insight.summaryNarrative}</p>
    </div>
  );
}
