# Home Buddy — UX Workflow & Mind Map

---

## High-Level Flow

```
┌─────────────┐     ┌─────────────┐     ┌──────────────┐     ┌───────────────┐
│  First Visit │────▶│   Sign In   │────▶│  Onboarding  │────▶│   Dashboard   │
│  (Landing)   │     │  (Replit)   │     │  (New Users) │     │  (Home Base)  │
└─────────────┘     └─────────────┘     └──────────────┘     └───────┬───────┘
                                                                     │
                    ┌────────────────────────────────────────────────┐│
                    │                                                ││
          ┌────────▼──────┐  ┌──────────┐  ┌───────────┐  ┌────────▼──────┐
          │   Assistant   │  │ Documents │  │ Inspections│  │   History     │
          │   (AI Chat)   │  │ (Files)   │  │ (Reports)  │  │ (Maint. Log)  │
          └───────────────┘  └──────────┘  └───────────┘  └───────────────┘
                    │                                                │
                    └────────────────────┬───────────────────────────┘
                                         │
                                  ┌──────▼──────┐
                                  │   Profile   │
                                  │  & Settings │
                                  └─────────────┘
```

---

## 1. Landing Page (Unauthenticated)

```
Landing Page
├── Hero Section
│   ├── Headline: "Your home, perfectly maintained."
│   ├── Subheadline: AI-powered home maintenance
│   └── CTA → "Get Started Free" → Sign In
│
├── Feature Demos (Interactive Previews)
│   ├── Dashboard Demo — shows task overview UI
│   ├── Chat Demo — shows AI assistant conversation
│   └── Documents Demo — shows file upload interface
│
├── Benefits List
│   ├── Track all home systems in one place
│   ├── Get reminders before issues become emergencies
│   ├── Know when to DIY vs. call a pro
│   ├── See estimated costs before you commit
│   ├── Access permit requirements for your area
│   └── Build trust with transparent safety guidance
│
├── Header Nav
│   └── Sign In button → /api/login (Replit OAuth)
│
└── Footer
    ├── Terms of Service link
    └── Contact link
```

---

## 2. Authentication

```
Sign In Flow
├── Replit OAuth (PKCE)
│   ├── Google account
│   ├── GitHub account
│   ├── Apple account
│   └── Email login
│
├── On Success
│   ├── New User → Onboarding (/onboarding)
│   └── Returning User → Dashboard (/dashboard)
│
└── Session Management
    ├── Session stored in PostgreSQL
    └── Persistent across browser sessions
```

---

## 3. Onboarding (First-Time Users)

```
Onboarding Flow (3 Steps)
│
├── Step 1: Address
│   ├── Address autocomplete (Google Places API)
│   ├── Optional: USPS address verification
│   └── Next →
│
├── Step 2: Home Details
│   ├── Year built (1600–2026)
│   ├── Square footage (100–100,000)
│   └── Next →
│
├── Step 3: Confirm & Create
│   ├── Review summary of entered info
│   ├── "Create My Home Profile" button
│   └── On success → Dashboard with guided tour
│
└── Validation
    ├── Address required for Step 1
    ├── Numeric ranges enforced
    └── Toast errors for invalid input
```

---

## 4. Dashboard (Home Base)

```
Dashboard
├── Greeting Header
│   └── "Good [morning/afternoon], here's your home at a glance"
│
├── Home Health Score
│   ├── Visual health indicator
│   ├── Based on overdue/pending tasks
│   └── Tappable for details
│
├── Home Info Card
│   ├── Address, year built, sq ft, beds, baths
│   ├── Edit mode (inline editing)
│   │   ├── Field validation (beds 1-50, baths 1-50, sqFt 100-100k, year 1600-2026)
│   │   └── Save/Cancel actions
│   └── Display mode (read-only)
│
├── Systems Section
│   ├── List of home systems (HVAC, plumbing, electrical, etc.)
│   ├── Add System Wizard
│   │   ├── System type selection
│   │   ├── Brand/model/age details
│   │   └── Creates system + auto-generates maintenance tasks
│   └── Each system shows related tasks
│
├── Maintenance Tasks
│   ├── Task list with urgency badges
│   │   ├── 🔴 Urgent (safety concern)
│   │   ├── 🟠 Soon (address within weeks)
│   │   ├── 🟡 Upcoming (plan ahead)
│   │   └── 🟢 Routine (regular maintenance)
│   │
│   ├── Quick Add Task (+ button)
│   │   ├── Task title
│   │   ├── Urgency level
│   │   ├── Category
│   │   ├── DIY level (DIY-Safe / Needs-Pro / Assess-First)
│   │   └── Estimated cost
│   │
│   └── Task Actions
│       ├── Mark complete → creates log entry
│       ├── View details
│       └── Status transitions (pending → in_progress → completed)
│
├── Contractor Section (Opt-in)
│   ├── Angi integration for pro research
│   ├── Contractor schedule / appointments
│   └── Never pushy — user opts in
│
└── Onboarding Tour (First Visit)
    ├── Highlights key UI elements
    ├── Step-by-step tooltips
    └── Dismissible / skippable
```

---

## 5. AI Assistant (Chat)

```
AI Assistant
├── Session Sidebar
│   ├── Desktop: Collapsible panel (left side)
│   ├── Mobile: Slide-out drawer
│   │
│   ├── "New Chat" button → creates fresh session
│   ├── Session List
│   │   ├── Auto-titled from first message
│   │   ├── Editable titles (pencil icon)
│   │   ├── Timestamp display
│   │   └── Click to switch sessions
│   └── Toggle sidebar open/closed
│
├── Chat Interface
│   ├── Message History
│   │   ├── User messages (right-aligned)
│   │   ├── AI responses (left-aligned, with avatar)
│   │   ├── Rich text rendering (bold, lists, code, headers)
│   │   └── Streaming responses (real-time token display)
│   │
│   ├── Message Input
│   │   ├── Text area (multi-line)
│   │   ├── Send button
│   │   └── Photo upload button (camera icon)
│   │
│   ├── Photo Analysis (Vision API)
│   │   ├── Consent modal (first use)
│   │   ├── Upload photo of home issue
│   │   ├── AI analyzes image + provides guidance
│   │   └── Privacy controls for image storage
│   │
│   └── AI Behavior
│       ├── Context-aware (knows your home details)
│       ├── Provides cost estimates as ranges
│       ├── DIY vs. pro recommendations
│       ├── Safety disclaimers included
│       └── "You're in control" messaging throughout
│
├── Empty State (No Home)
│   └── Prompt to create home profile first → /onboarding
│
└── Privacy
    ├── Data storage opt-out available
    └── Photo consent required before vision features
```

---

## 6. Maintenance History (Log)

```
Maintenance History
├── Log Entry List
│   ├── Chronological entries
│   ├── Each entry shows:
│   │   ├── Date performed
│   │   ├── Description of work
│   │   ├── Cost (if recorded)
│   │   ├── Who did it (DIY vs. contractor)
│   │   └── Related task (if any)
│   │
│   └── Filterable / scrollable
│
├── Add Log Entry
│   ├── Manual entry form
│   │   ├── Description
│   │   ├── Date
│   │   ├── Cost
│   │   ├── Contractor info (optional)
│   │   └── Link to existing task (optional)
│   │
│   └── Auto-created when completing tasks from Dashboard
│
└── Task Completion Flow
    ├── Dashboard: Mark task complete
    ├── → Automatically creates log entry
    └── → Updates task status to "completed"
```

---

## 7. Inspections (Reports)

```
Inspections
├── Report List
│   ├── Each report shows:
│   │   ├── Title / filename
│   │   ├── Upload date
│   │   ├── Status badge (uploaded / analyzing / analyzed)
│   │   └── Finding count (after analysis)
│   │
│   └── Empty state with upload prompt
│
├── Upload Report
│   ├── Object Storage upload (GCS presigned URLs)
│   ├── Supported: PDF, images
│   └── Creates report record on upload
│
├── AI Analysis
│   ├── "Analyze" button on uploaded reports
│   ├── GPT-4o processes report content
│   ├── Extracts findings automatically
│   └── Background job processing
│
├── Report Detail View
│   ├── Report metadata
│   ├── Findings List
│   │   ├── Title & description
│   │   ├── Severity badge (critical / major / moderate / minor / informational)
│   │   ├── Urgency level
│   │   ├── Category & location
│   │   ├── Estimated cost
│   │   └── DIY level recommendation
│   │
│   └── Actions
│       └── Delete report (with confirmation dialog)
│
└── Delete Flow
    ├── Confirmation dialog
    ├── Removes report + all findings
    └── Toast confirmation
```

---

## 8. Documents (File Storage)

```
Documents
├── Document List
│   ├── Each document shows:
│   │   ├── File icon (by type: PDF, image, generic)
│   │   ├── Filename
│   │   ├── Category badge
│   │   ├── Upload date
│   │   ├── Download link
│   │   └── Delete button
│   │
│   └── Empty state with upload prompt
│
├── Upload Document
│   ├── Category selection
│   │   ├── General
│   │   ├── Insurance
│   │   ├── Warranty
│   │   ├── Permit
│   │   ├── Receipt
│   │   ├── Inspection
│   │   ├── Appraisal
│   │   └── Other
│   │
│   ├── File picker (ObjectUploader component)
│   ├── GCS presigned URL upload flow
│   └── Creates document record with metadata
│
└── Delete Flow
    ├── Confirmation dialog
    ├── Removes document record
    └── Toast confirmation
```

---

## 9. Profile & Settings

```
Profile
├── Account Info
│   ├── Email (from OAuth, read-only)
│   └── User identity display
│
├── Home Details
│   ├── Address (editable)
│   └── Save changes
│
├── Privacy Settings
│   ├── Data storage opt-out toggle
│   ├── Controls what AI stores
│   └── Persisted per user
│
├── Notification Settings
│   ├── Email notification preferences
│   └── Digest frequency
│
└── Danger Zone
    ├── Delete account
    ├── Confirmation dialog
    └── Permanent action warning
```

---

## 10. Navigation Structure

```
Navigation
├── Desktop Sidebar (always visible)
│   ├── Logo + "Home Buddy" branding
│   ├── Nav Items:
│   │   ├── Overview (Dashboard) — "What needs attention"
│   │   ├── History (Maintenance Log) — "What you've done"
│   │   ├── Inspections — "What's wrong"
│   │   ├── Documents — "Your files"
│   │   ├── Assistant (Chat) — "Get guidance"
│   │   ├── Profile — "Your settings"
│   │   └── Contact — "Reach us"
│   └── Logout button
│
├── Mobile Bottom Nav (4 quick-access items)
│   ├── Home (Dashboard)
│   ├── History (Maintenance Log)
│   ├── Assistant (Chat)
│   └── Reports (Inspections)
│
├── Mobile Header
│   ├── Logo + branding
│   └── Hamburger menu → full nav drawer
│
└── Active State
    ├── Orange highlight on current page
    └── Sublabels for context
```

---

## 11. Cross-Cutting Concerns

```
UX Patterns
├── Loading States
│   ├── Splash screen (animated, first visit per session)
│   ├── Skeleton loaders on every data page
│   └── Spinner indicators for mutations
│
├── Error Handling
│   ├── Toast notifications (success / error)
│   ├── Form validation with field-level feedback
│   ├── Error boundary (catches React crashes)
│   └── Graceful empty states (no data yet)
│
├── Dark Mode
│   ├── Full theme support across all pages
│   ├── System preference detection
│   └── Orange-to-dark gradient on landing
│
├── Mobile Responsiveness
│   ├── Safe-area handling (notch/home indicator)
│   ├── Bottom nav for thumb-friendly access
│   ├── Slide-out drawers for secondary panels
│   └── Touch-optimized tap targets
│
├── PWA (Progressive Web App)
│   ├── Installable on iOS / Android / Desktop
│   ├── Service worker for offline shell
│   ├── App manifest with icons
│   └── Splash screen on install
│
├── Analytics (Google Analytics 4)
│   ├── Page view tracking
│   ├── Event tracking (navigation, actions, onboarding steps)
│   └── Privacy-respecting implementation
│
└── Tone & Messaging
    ├── Calm professional (not "friendly startup")
    ├── Anxiety-aware language
    ├── Cost estimates always shown as ranges
    ├── "You're in control" reinforcement
    └── AI disclaimers on all generated content
```

---

## User Journey Summary

```
First-Time User:
  Landing → Sign In → Onboarding (3 steps) → Dashboard (with tour)
  → Add systems → View tasks → Chat with assistant → Upload documents

Returning User:
  Sign In → Dashboard → Check tasks → Review reports
  → Chat history → Download documents → Update profile

Key Decision Points:
  • Add a system? → System Wizard → Auto-generates tasks
  • Complete a task? → Dashboard action → Auto-logs to History
  • Upload a report? → Inspections → AI analysis → Findings
  • Need guidance? → Assistant → Context-aware AI chat
  • Store a file? → Documents → Categorized upload
```

---

*Generated for Home Buddy — Last updated February 2026*
