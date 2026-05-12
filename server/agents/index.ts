/**
 * Agent registry entry point — import this once at server startup.
 * Each import self-registers via registerAgent().
 */

// Marketing agents
import "./marketing/seo-content-agent";
import "./marketing/social-content-agent";
import "./marketing/email-drip-agent";
import "./marketing/landing-copy-agent";
import "./marketing/seo-performance-agent";

// Engagement agents
import "./engagement/maintenance-reminder-agent";
import "./engagement/reengagement-agent";
import "./engagement/home-health-alert-agent";
import "./engagement/seasonal-prep-agent";
import "./engagement/onboarding-coach-agent";
import "./engagement/churn-save-agent";
import "./engagement/dunning-agent";

// Maintenance agents
import "./maintenance/task-suggestion-agent";
import "./maintenance/home-report-agent";

// System agents
import "./system/founder-brief-agent";

export { AgentRunner, registerAgent, getRegisteredSlugs } from "./runner";
