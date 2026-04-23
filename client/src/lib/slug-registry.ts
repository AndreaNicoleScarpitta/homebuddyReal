export const PAGE_SLUGS = {
  dashboard: "dashboard",
  onboarding: "onboarding",
  documentAnalysis: "document-analysis",
  disclaimer: "disclaimer",
  maintenanceLog: "maintenance-log",
  systemDetail: "system-detail",
  systems: "systems",
  documents: "documents",
  profile: "profile",
  contact: "contact",
  terms: "terms",
  landing: "landing",
  login: "login",
  signup: "signup",
  budget: "budget",
  chat: "chat",
  inspections: "inspections",
  notFound: "not-found",
  calendar: "calendar",
  guideMonthlyChecklist: "guide-monthly-checklist",
  guideAnnualSchedule: "guide-annual-schedule",
  guideNewHomeowner: "guide-new-homeowner",
  guideFirst90Days: "guide-first-90-days",
  guideHomeInspection: "guide-home-inspection",
  guideMaintenanceCost: "guide-maintenance-cost",
  guidePrintableSchedule: "guide-printable-schedule",
} as const;

export const MODAL_SLUGS = {
  addSystem: "modal-add-system",
  addTask: "modal-add-task",
  completeTask: "modal-complete-task",
  addLogEntry: "modal-add-log-entry",
  deleteSystem: "modal-delete-system",
  deleteReport: "modal-delete-report",
  deleteAccount: "modal-delete-account",
  circuitMap: "modal-circuit-map",
  photoConsent: "modal-photo-consent",
  donation: "modal-donation",
  definitions: "modal-definitions",
  mobileNav: "modal-mobile-nav",
  onboardingTour: "modal-onboarding-tour",
} as const;

export const ALL_SLUGS = [
  ...Object.values(PAGE_SLUGS),
  ...Object.values(MODAL_SLUGS),
];

const SLUG_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function validateUniqueSlugs(slugs: string[] = ALL_SLUGS) {
  const seen = new Set<string>();

  for (const slug of slugs) {
    if (!slug) {
      throw new Error("Empty slug detected in registry");
    }

    if (!SLUG_REGEX.test(slug)) {
      throw new Error(`Invalid slug format: "${slug}" — must be lowercase kebab-case`);
    }

    if (seen.has(slug)) {
      throw new Error(`Duplicate slug detected: "${slug}"`);
    }

    seen.add(slug);
  }

  return true;
}
