/**
 * Calendar Sync page — lets users subscribe to their Home Buddy maintenance
 * schedule in Google Calendar, Apple Calendar, or any iCal-compatible app.
 *
 * The server generates a stable, token-signed iCal feed URL at
 * /api/calendar/:token.ics. This page surfaces that URL with one-click
 * subscribe buttons for each major platform.
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getCalendarFeed, getTasks, getHome } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { trackEvent } from "@/lib/analytics";
import {
  Calendar,
  Copy,
  Check,
  ExternalLink,
  RefreshCw,
  CalendarCheck,
  Zap,
  Clock,
  AlertCircle,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Platform buttons
// ---------------------------------------------------------------------------

function GoogleCalendarButton({ webcalUrl }: { webcalUrl: string }) {
  const encoded = encodeURIComponent(webcalUrl);
  const href = `https://calendar.google.com/calendar/render?cid=${encoded}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => trackEvent("click", "calendar", "google")}
      className="flex items-center gap-3 px-5 py-4 rounded-xl border-2 border-border hover:border-primary/40 hover:bg-primary/5 transition-all group no-underline"
      data-testid="btn-google-calendar"
    >
      {/* Google Calendar colour-accurate G icon */}
      <svg viewBox="0 0 48 48" className="h-8 w-8 shrink-0" aria-hidden="true">
        <rect width="48" height="48" rx="8" fill="#fff" />
        <path d="M34 14H14a4 4 0 0 0-4 4v16a4 4 0 0 0 4 4h20a4 4 0 0 0 4-4V18a4 4 0 0 0-4-4z" fill="#1a73e8" />
        <rect x="10" y="20" width="28" height="2" fill="#fff" opacity=".3" />
        <text x="24" y="35" textAnchor="middle" fontSize="13" fontWeight="700" fill="#fff" fontFamily="sans-serif">31</text>
        <circle cx="17" cy="14" r="2" fill="#ea4335" />
        <circle cx="31" cy="14" r="2" fill="#ea4335" />
      </svg>
      <div className="text-left">
        <p className="font-semibold text-foreground text-sm group-hover:text-primary transition-colors">Google Calendar</p>
        <p className="text-xs text-muted-foreground">Opens in a new tab → click "Add"</p>
      </div>
      <ExternalLink className="h-4 w-4 text-muted-foreground ml-auto shrink-0 group-hover:text-primary transition-colors" />
    </a>
  );
}

function AppleCalendarButton({ webcalUrl }: { webcalUrl: string }) {
  return (
    <a
      href={webcalUrl}
      onClick={() => trackEvent("click", "calendar", "apple")}
      className="flex items-center gap-3 px-5 py-4 rounded-xl border-2 border-border hover:border-primary/40 hover:bg-primary/5 transition-all group no-underline"
      data-testid="btn-apple-calendar"
    >
      <svg viewBox="0 0 48 48" className="h-8 w-8 shrink-0" aria-hidden="true">
        <rect width="48" height="48" rx="8" fill="#fff" />
        <rect x="8" y="12" width="32" height="28" rx="4" fill="#ff3b30" />
        <rect x="8" y="18" width="32" height="22" rx="0" fill="#fff" />
        <rect x="8" y="18" width="32" height="4" fill="#fff" />
        <text x="24" y="36" textAnchor="middle" fontSize="13" fontWeight="700" fill="#1c1c1e" fontFamily="sans-serif">31</text>
        <circle cx="17" cy="12" r="2" fill="#1c1c1e" />
        <circle cx="31" cy="12" r="2" fill="#1c1c1e" />
      </svg>
      <div className="text-left">
        <p className="font-semibold text-foreground text-sm group-hover:text-primary transition-colors">Apple Calendar</p>
        <p className="text-xs text-muted-foreground">macOS / iOS — opens Calendar app</p>
      </div>
      <ExternalLink className="h-4 w-4 text-muted-foreground ml-auto shrink-0 group-hover:text-primary transition-colors" />
    </a>
  );
}

function OutlookButton({ feedUrl }: { feedUrl: string }) {
  const encoded = encodeURIComponent(feedUrl);
  const href = `https://outlook.live.com/calendar/0/addcalendar?url=${encoded}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => trackEvent("click", "calendar", "outlook")}
      className="flex items-center gap-3 px-5 py-4 rounded-xl border-2 border-border hover:border-primary/40 hover:bg-primary/5 transition-all group no-underline"
      data-testid="btn-outlook-calendar"
    >
      <svg viewBox="0 0 48 48" className="h-8 w-8 shrink-0" aria-hidden="true">
        <rect width="48" height="48" rx="8" fill="#0078d4" />
        <rect x="10" y="10" width="16" height="28" rx="2" fill="#fff" opacity=".9" />
        <text x="18" y="28" textAnchor="middle" fontSize="9" fontWeight="700" fill="#0078d4" fontFamily="sans-serif">31</text>
        <rect x="28" y="16" width="12" height="2" rx="1" fill="#fff" />
        <rect x="28" y="21" width="12" height="2" rx="1" fill="#fff" />
        <rect x="28" y="26" width="10" height="2" rx="1" fill="#fff" />
        <rect x="28" y="31" width="12" height="2" rx="1" fill="#fff" />
      </svg>
      <div className="text-left">
        <p className="font-semibold text-foreground text-sm group-hover:text-primary transition-colors">Outlook</p>
        <p className="text-xs text-muted-foreground">Outlook.com or Office 365</p>
      </div>
      <ExternalLink className="h-4 w-4 text-muted-foreground ml-auto shrink-0 group-hover:text-primary transition-colors" />
    </a>
  );
}

// ---------------------------------------------------------------------------
// Upcoming tasks preview
// ---------------------------------------------------------------------------

const URGENCY_COLOR: Record<string, string> = {
  now: "text-red-600 dark:text-red-400",
  soon: "text-orange-600 dark:text-orange-400",
  later: "text-green-600 dark:text-green-400",
  monitor: "text-blue-600 dark:text-blue-400",
};

function UpcomingTasksList({ homeId }: { homeId: string | number }) {
  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["tasks", homeId],
    queryFn: () => getTasks(homeId),
    enabled: !!homeId,
  });

  const upcoming = tasks
    .filter((t) => t.dueDate && t.status !== "completed")
    .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
    .slice(0, 8);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-12 rounded-lg bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  if (upcoming.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
        <CalendarCheck className="h-10 w-10 mb-3 opacity-30" />
        <p className="text-sm">No tasks with due dates yet.</p>
        <p className="text-xs mt-1">Set due dates on your tasks — they'll appear here and in your calendar.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {upcoming.map((task) => {
        const due = task.dueDate ? new Date(task.dueDate) : null;
        const isOverdue = due && due < new Date();
        return (
          <div
            key={task.id}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-muted/40 hover:bg-muted/70 transition-colors text-sm"
          >
            <Calendar className={`h-4 w-4 shrink-0 ${URGENCY_COLOR[task.urgency || "later"] || "text-muted-foreground"}`} />
            <span className="flex-1 truncate font-medium text-foreground">{task.title}</span>
            {due && (
              <span className={`shrink-0 text-xs font-medium ${isOverdue ? "text-destructive" : "text-muted-foreground"}`}>
                {isOverdue ? "Overdue · " : ""}
                {due.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
            )}
          </div>
        );
      })}
      {tasks.filter((t) => t.dueDate && t.status !== "completed").length > 8 && (
        <p className="text-xs text-center text-muted-foreground pt-1">
          + {tasks.filter((t) => t.dueDate && t.status !== "completed").length - 8} more tasks in your feed
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function CalendarPage() {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const { data: home } = useQuery({
    queryKey: ["home"],
    queryFn: getHome,
  });

  const { data: feed, isLoading: feedLoading, error: feedError } = useQuery({
    queryKey: ["calendar-feed"],
    queryFn: getCalendarFeed,
    staleTime: 60 * 60 * 1000, // token is stable; don't refetch
  });

  const handleCopy = async () => {
    if (!feed?.url) return;
    try {
      await navigator.clipboard.writeText(feed.url);
      setCopied(true);
      trackEvent("click", "calendar", "copy_url");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast({ title: "Couldn't copy", description: "Please copy the URL manually.", variant: "destructive" });
    }
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">

        {/* Header */}
        <div className="space-y-1">
          <h1 className="text-3xl font-heading font-bold text-foreground">Calendar Sync</h1>
          <p className="text-muted-foreground">
            Subscribe once — your maintenance schedule lives alongside your dentist appointments.
          </p>
        </div>

        {/* How it works pills */}
        <div className="flex flex-wrap gap-3 text-sm">
          {[
            { icon: Zap, text: "One-time setup" },
            { icon: RefreshCw, text: "Auto-syncs every 6 hours" },
            { icon: CalendarCheck, text: "All calendar apps" },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted text-muted-foreground">
              <Icon className="h-3.5 w-3.5" />
              <span>{text}</span>
            </div>
          ))}
        </div>

        {/* Platform subscribe buttons */}
        <Card>
          <CardContent className="p-5 space-y-3">
            <p className="text-sm font-semibold text-foreground mb-4">Subscribe with your calendar app</p>

            {feedLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />)}
              </div>
            ) : feedError ? (
              <div className="flex items-center gap-2 text-sm text-destructive p-4 rounded-lg bg-destructive/10">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>Couldn't load your calendar feed. Try refreshing the page.</span>
              </div>
            ) : feed ? (
              <>
                <GoogleCalendarButton webcalUrl={feed.webcalUrl} />
                <AppleCalendarButton webcalUrl={feed.webcalUrl} />
                <OutlookButton feedUrl={feed.url} />

                {/* Manual URL copy — for other apps or power users */}
                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground mb-2 font-medium">Or copy the URL for any other app</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs bg-muted px-3 py-2 rounded-lg truncate font-mono text-muted-foreground">
                      {feed.url}
                    </code>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleCopy}
                      className="shrink-0"
                      data-testid="btn-copy-feed-url"
                    >
                      {copied ? (
                        <><Check className="h-3.5 w-3.5 mr-1.5 text-green-600" />Copied</>
                      ) : (
                        <><Copy className="h-3.5 w-3.5 mr-1.5" />Copy</>
                      )}
                    </Button>
                  </div>
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>

        {/* Step-by-step for Google (most common) */}
        <Card>
          <CardContent className="p-5">
            <p className="text-sm font-semibold text-foreground mb-4">Google Calendar — step by step</p>
            <ol className="space-y-3 text-sm text-muted-foreground">
              {[
                'Click "Google Calendar" above — Google Calendar opens in a new tab.',
                'A dialog appears: "Add calendar from URL." Your URL is already filled in.',
                'Click "Add calendar." Done.',
                'Tasks with due dates appear in your calendar within a few minutes.',
              ].map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center mt-0.5">
                    {i + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        {/* Upcoming tasks preview */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">What will appear in your calendar</h2>
            <Badge variant="outline" className="text-xs">
              <Clock className="h-3 w-3 mr-1" />
              Tasks with due dates
            </Badge>
          </div>
          {home?.id ? (
            <Card>
              <CardContent className="p-4">
                <UpcomingTasksList homeId={home.id} />
              </CardContent>
            </Card>
          ) : null}
          <p className="text-xs text-muted-foreground">
            Tasks without due dates won't appear. Set a due date on any task from your dashboard to include it.
          </p>
        </div>

        {/* Privacy note */}
        <p className="text-xs text-muted-foreground border-t pt-4">
          Your calendar URL contains a secure token unique to your account. Anyone with this URL can see your task titles and due dates. You can reset it by changing your password.
        </p>

      </div>
    </Layout>
  );
}
