from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.colors import HexColor
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak,
    Table, TableStyle, HRFlowable, Preformatted
)
from reportlab.lib.enums import TA_LEFT, TA_CENTER
from reportlab.lib import colors
import os

ORANGE = HexColor("#f97316")
DARK = HexColor("#1a1a2e")
GRAY = HexColor("#6b7280")
LIGHT_BG = HexColor("#f8f9fa")
WHITE = HexColor("#ffffff")

output_path = os.path.join(os.path.dirname(__file__), "..", "public", "Home-Buddy-UX-Workflow.pdf")

doc = SimpleDocTemplate(
    output_path,
    pagesize=letter,
    rightMargin=0.75*inch,
    leftMargin=0.75*inch,
    topMargin=0.75*inch,
    bottomMargin=0.75*inch,
)

styles = getSampleStyleSheet()

styles.add(ParagraphStyle(
    name='DocTitle',
    fontName='Helvetica-Bold',
    fontSize=28,
    textColor=DARK,
    spaceAfter=6,
    alignment=TA_CENTER,
))

styles.add(ParagraphStyle(
    name='DocSubtitle',
    fontName='Helvetica',
    fontSize=12,
    textColor=GRAY,
    spaceAfter=30,
    alignment=TA_CENTER,
))

styles.add(ParagraphStyle(
    name='SectionTitle',
    fontName='Helvetica-Bold',
    fontSize=18,
    textColor=ORANGE,
    spaceBefore=24,
    spaceAfter=10,
    borderPadding=(0, 0, 4, 0),
))

styles.add(ParagraphStyle(
    name='SubSection',
    fontName='Helvetica-Bold',
    fontSize=13,
    textColor=DARK,
    spaceBefore=14,
    spaceAfter=6,
))

styles.add(ParagraphStyle(
    name='BodyText2',
    fontName='Helvetica',
    fontSize=10,
    textColor=DARK,
    spaceAfter=6,
    leading=14,
))

styles.add(ParagraphStyle(
    name='BulletItem',
    fontName='Helvetica',
    fontSize=10,
    textColor=DARK,
    spaceAfter=4,
    leftIndent=20,
    leading=14,
))

styles.add(ParagraphStyle(
    name='SubBullet',
    fontName='Helvetica',
    fontSize=9.5,
    textColor=GRAY,
    spaceAfter=3,
    leftIndent=40,
    leading=13,
))

styles.add(ParagraphStyle(
    name='FlowBox',
    fontName='Courier',
    fontSize=9,
    textColor=DARK,
    spaceAfter=10,
    spaceBefore=6,
    leftIndent=10,
    leading=12,
    backColor=LIGHT_BG,
    borderPadding=10,
))

styles.add(ParagraphStyle(
    name='FooterText',
    fontName='Helvetica-Oblique',
    fontSize=8,
    textColor=GRAY,
    alignment=TA_CENTER,
))

story = []

def add_divider():
    story.append(Spacer(1, 8))
    story.append(HRFlowable(width="100%", thickness=1, color=HexColor("#e5e7eb"), spaceBefore=4, spaceAfter=12))

def add_section(title):
    add_divider()
    story.append(Paragraph(title, styles['SectionTitle']))

def add_subsection(title):
    story.append(Paragraph(title, styles['SubSection']))

def add_body(text):
    story.append(Paragraph(text, styles['BodyText2']))

def add_bullet(text):
    story.append(Paragraph(f"\u2022  {text}", styles['BulletItem']))

def add_sub_bullet(text):
    story.append(Paragraph(f"    \u2013  {text}", styles['SubBullet']))

def add_flow_text(text):
    story.append(Preformatted(text, styles['FlowBox']))


story.append(Spacer(1, 60))
story.append(Paragraph("Home Buddy", styles['DocTitle']))
story.append(Paragraph("UX Workflow &amp; Mind Map", styles['DocSubtitle']))
story.append(Spacer(1, 10))
story.append(HRFlowable(width="40%", thickness=3, color=ORANGE, spaceBefore=0, spaceAfter=20))
story.append(Paragraph("A complete map of every user-facing screen, interaction, and decision point.", styles['BodyText2']))
story.append(Paragraph("February 2026", styles['FooterText']))
story.append(Spacer(1, 30))

add_section("High-Level Flow")
add_flow_text(
    "First Visit (Landing)\n"
    "       |\n"
    "   Sign In (Replit OAuth)\n"
    "       |\n"
    "   New User? --Yes--> Onboarding (3 steps)\n"
    "       |                    |\n"
    "       No                   v\n"
    "       |              Dashboard (Home Base)\n"
    "       |                    |\n"
    "       +---------+----------+----------+-----------+\n"
    "       |         |          |          |           |\n"
    "   Assistant  Documents  Inspections  History   Profile\n"
    "   (AI Chat)  (Files)    (Reports)    (Log)    (Settings)"
)


add_section("1. Landing Page (Unauthenticated)")
add_body("The public-facing marketing page that introduces Home Buddy to new visitors.")
add_subsection("Hero Section")
add_bullet('Headline: "Your home, perfectly maintained."')
add_bullet("Subheadline: AI-Powered Home Maintenance badge")
add_bullet('CTA: "Get Started Free" button \u2192 Sign In')
add_subsection("Feature Demos")
add_bullet("Dashboard Demo \u2014 interactive preview of task overview")
add_bullet("Chat Demo \u2014 shows AI assistant conversation")
add_bullet("Documents Demo \u2014 shows file upload interface")
add_subsection("Benefits List")
add_bullet("Track all home systems in one place")
add_bullet("Get reminders before issues become emergencies")
add_bullet("Know when to DIY vs. call a pro")
add_bullet("See estimated costs before you commit")
add_bullet("Access permit requirements for your area")
add_bullet("Build trust with transparent safety guidance")
add_subsection("Navigation")
add_bullet("Header: Logo + Sign In button")
add_bullet("Footer: Terms of Service, Contact links")


add_section("2. Authentication")
add_body("Users sign in via Replit OAuth (PKCE flow). Supports multiple identity providers.")
add_subsection("Sign In Methods")
add_bullet("Google account")
add_bullet("GitHub account")
add_bullet("Apple account")
add_bullet("Email login")
add_subsection("Post-Authentication Routing")
add_bullet("New user (no home profile) \u2192 Onboarding")
add_bullet("Returning user \u2192 Dashboard")
add_bullet("Session stored in PostgreSQL, persistent across visits")


add_section("3. Onboarding (First-Time Users)")
add_body("A guided 3-step wizard to set up the user's home profile.")
add_subsection("Step 1: Address")
add_bullet("Address autocomplete (Google Places API)")
add_bullet("Optional USPS address verification")
add_subsection("Step 2: Home Details")
add_bullet("Year built (1600\u20132026)")
add_bullet("Square footage (100\u2013100,000)")
add_subsection("Step 3: Confirm &amp; Create")
add_bullet("Review summary of entered information")
add_bullet('"Create My Home Profile" button')
add_bullet("On success \u2192 Dashboard with guided onboarding tour")
add_subsection("Validation")
add_bullet("Address required for Step 1")
add_bullet("Numeric ranges enforced with min/max attributes")
add_bullet("Toast error notifications for invalid input")


story.append(PageBreak())

add_section("4. Dashboard (Home Base)")
add_body("The central hub. Everything the homeowner needs at a glance.")
add_subsection("Greeting Header")
add_bullet('"Good [morning/afternoon], here\'s your home at a glance"')
add_subsection("Home Health Score")
add_bullet("Visual health indicator based on overdue/pending tasks")
add_bullet("Tappable for detailed breakdown")
add_subsection("Home Info Card")
add_bullet("Displays: address, year built, sq ft, beds, baths")
add_bullet("Inline edit mode with field validation")
add_sub_bullet("Beds: 1\u201350")
add_sub_bullet("Baths: 1\u201350 (whole numbers)")
add_sub_bullet("Sq Ft: 100\u2013100,000")
add_sub_bullet("Year Built: 1600\u20132026")
add_subsection("Systems Section")
add_bullet("List of home systems (HVAC, plumbing, electrical, etc.)")
add_bullet("Add System Wizard: type \u2192 brand/model/age \u2192 auto-generates tasks")
add_subsection("Maintenance Tasks")
add_bullet("\U0001f534 Urgent \u2014 safety concern, act immediately")
add_bullet("\U0001f7e0 Soon \u2014 address within weeks")
add_bullet("\U0001f7e1 Upcoming \u2014 plan ahead")
add_bullet("\U0001f7e2 Routine \u2014 regular maintenance")
add_subsection("Quick Add Task")
add_bullet("Title, urgency, category, DIY level, estimated cost")
add_subsection("Task Actions")
add_bullet("Mark complete \u2192 auto-creates maintenance log entry")
add_bullet("Status transitions: pending \u2192 in_progress \u2192 completed")
add_subsection("Contractor Section (Opt-in)")
add_bullet("Angi integration for pro research")
add_bullet("Contractor schedule / appointments")
add_bullet("Never pushy \u2014 user opts in only")
add_subsection("Onboarding Tour")
add_bullet("First-visit tooltip walkthrough of key UI elements")
add_bullet("Dismissible / skippable")


add_section("5. AI Assistant (Chat)")
add_body("Context-aware AI chat powered by GPT-4o with session management.")
add_subsection("Session Sidebar")
add_bullet("Desktop: Collapsible panel on left side")
add_bullet("Mobile: Slide-out drawer")
add_bullet('"New Chat" button creates fresh session')
add_bullet("Session list with auto-generated titles")
add_bullet("Editable titles (pencil icon)")
add_bullet("Click to switch between sessions")
add_subsection("Chat Interface")
add_bullet("User messages (right-aligned) / AI responses (left-aligned)")
add_bullet("Rich text rendering: bold, lists, code blocks, headers")
add_bullet("Streaming responses (real-time token display)")
add_subsection("Photo Analysis (Vision API)")
add_bullet("Consent modal on first use")
add_bullet("Upload photo of home issue for AI analysis")
add_bullet("Privacy controls for image storage")
add_subsection("AI Behavior")
add_bullet("Context-aware \u2014 knows your home details, systems, tasks")
add_bullet("Cost estimates always shown as ranges")
add_bullet("DIY vs. pro recommendations")
add_bullet('Safety disclaimers + "You\'re in control" messaging')


add_section("6. Maintenance History (Log)")
add_body("A chronological record of all work done on the home.")
add_subsection("Log Entry List")
add_bullet("Date performed, description, cost, who did it")
add_bullet("Related task link (if applicable)")
add_bullet("Filterable and scrollable")
add_subsection("Add Log Entry")
add_bullet("Manual entry: description, date, cost, contractor info")
add_bullet("Link to existing task (optional)")
add_subsection("Auto-Creation")
add_bullet("Completing a task on Dashboard auto-creates a log entry")
add_bullet("Updates task status to completed")


story.append(PageBreak())

add_section("7. Inspections (Reports)")
add_body("Upload inspection reports for AI-powered analysis and finding extraction.")
add_subsection("Report List")
add_bullet("Title, upload date, status badge, finding count")
add_bullet("Status: uploaded \u2192 analyzing \u2192 analyzed")
add_subsection("Upload Report")
add_bullet("Object Storage upload via GCS presigned URLs")
add_bullet("Supports PDF and image files")
add_subsection("AI Analysis")
add_bullet('"Analyze" button triggers GPT-4o processing')
add_bullet("Automatically extracts findings from report content")
add_bullet("Background job processing")
add_subsection("Report Detail View")
add_bullet("Findings list with severity badges:")
add_sub_bullet("Critical (red)")
add_sub_bullet("Major (orange)")
add_sub_bullet("Moderate (yellow)")
add_sub_bullet("Minor (blue)")
add_sub_bullet("Informational (gray)")
add_bullet("Each finding: title, description, urgency, category, location, estimated cost, DIY level")
add_subsection("Delete Flow")
add_bullet("Confirmation dialog \u2192 removes report + all findings \u2192 toast confirmation")


add_section("8. Documents (File Storage)")
add_body("Categorized cloud storage for important home files.")
add_subsection("Document List")
add_bullet("File icon by type (PDF, image, generic)")
add_bullet("Filename, category badge, upload date")
add_bullet("Download and delete actions")
add_subsection("Upload Document")
add_bullet("Category selection:")
add_sub_bullet("General, Insurance, Warranty, Permit")
add_sub_bullet("Receipt, Inspection, Appraisal, Other")
add_bullet("File picker with GCS presigned URL upload")
add_subsection("Delete Flow")
add_bullet("Confirmation dialog \u2192 removes record \u2192 toast confirmation")


add_section("9. Profile &amp; Settings")
add_body("Account management, privacy controls, and notification preferences.")
add_subsection("Account Info")
add_bullet("Email from OAuth (read-only)")
add_bullet("User identity display")
add_subsection("Home Details")
add_bullet("Address (editable) with save")
add_subsection("Privacy Settings")
add_bullet("Data storage opt-out toggle")
add_bullet("Controls what AI stores about conversations")
add_subsection("Notification Settings")
add_bullet("Email notification preferences")
add_bullet("Digest frequency configuration")
add_subsection("Danger Zone")
add_bullet("Delete account with confirmation dialog")
add_bullet("Permanent action warning")


add_section("10. Navigation Structure")
add_subsection("Desktop Sidebar (Always Visible)")
add_bullet("Logo + Home Buddy branding")
add_bullet('Overview \u2014 "What needs attention"')
add_bullet('History \u2014 "What you\'ve done"')
add_bullet('Inspections \u2014 "What\'s wrong"')
add_bullet('Documents \u2014 "Your files"')
add_bullet('Assistant \u2014 "Get guidance"')
add_bullet('Profile \u2014 "Your settings"')
add_bullet('Contact \u2014 "Reach us"')
add_bullet("Logout button")
add_subsection("Mobile Bottom Nav (4 Quick-Access Items)")
add_bullet("Home (Dashboard)")
add_bullet("History (Maintenance Log)")
add_bullet("Assistant (Chat)")
add_bullet("Reports (Inspections)")
add_subsection("Mobile Header")
add_bullet("Logo + branding")
add_bullet("Hamburger menu \u2192 full nav drawer with all items")


add_section("11. Cross-Cutting UX Patterns")
add_subsection("Loading States")
add_bullet("Animated splash screen (first visit per session)")
add_bullet("Skeleton loaders on every data-driven page")
add_bullet("Spinner indicators during mutations")
add_subsection("Error Handling")
add_bullet("Toast notifications (success / error)")
add_bullet("Field-level form validation")
add_bullet("Error boundary catches React crashes")
add_bullet("Graceful empty states when no data exists")
add_subsection("Dark Mode")
add_bullet("Full theme support across all pages")
add_bullet("System preference detection")
add_bullet("Orange-to-dark gradient on landing page")
add_subsection("Mobile Responsiveness")
add_bullet("Safe-area handling for notch and home indicator")
add_bullet("Bottom nav for thumb-friendly access")
add_bullet("Slide-out drawers for secondary panels")
add_bullet("Touch-optimized tap targets")
add_subsection("PWA (Progressive Web App)")
add_bullet("Installable on iOS, Android, and Desktop")
add_bullet("Service worker for offline shell")
add_bullet("App manifest with custom icons")
add_subsection("Analytics (Google Analytics 4)")
add_bullet("Page view tracking")
add_bullet("Event tracking: navigation, actions, onboarding steps")
add_bullet("Privacy-respecting implementation")
add_subsection("Tone &amp; Messaging")
add_bullet("Calm professional \u2014 not friendly startup")
add_bullet("Anxiety-aware language throughout")
add_bullet("Cost estimates always shown as ranges")
add_bullet('"You\'re in control" reinforcement')
add_bullet("AI disclaimers on all generated content")


story.append(PageBreak())
add_section("User Journey Summary")

add_subsection("First-Time User")
add_flow_text(
    "Landing --> Sign In --> Onboarding (3 steps)\n"
    "  --> Dashboard (with guided tour)\n"
    "  --> Add systems --> View tasks\n"
    "  --> Chat with assistant\n"
    "  --> Upload documents"
)

add_subsection("Returning User")
add_flow_text(
    "Sign In --> Dashboard\n"
    "  --> Check tasks --> Review reports\n"
    "  --> Chat history --> Download documents\n"
    "  --> Update profile"
)

add_subsection("Key Decision Points")
add_bullet("Add a system? \u2192 System Wizard \u2192 Auto-generates maintenance tasks")
add_bullet("Complete a task? \u2192 Dashboard action \u2192 Auto-logs to History")
add_bullet("Upload a report? \u2192 Inspections \u2192 AI analysis \u2192 Findings extracted")
add_bullet("Need guidance? \u2192 Assistant \u2192 Context-aware AI chat")
add_bullet("Store a file? \u2192 Documents \u2192 Categorized upload with cloud storage")

story.append(Spacer(1, 40))
story.append(HRFlowable(width="100%", thickness=1, color=HexColor("#e5e7eb"), spaceBefore=4, spaceAfter=12))
story.append(Paragraph("Home Buddy \u2014 UX Workflow &amp; Mind Map \u2014 February 2026", styles['FooterText']))

doc.build(story)
print(f"PDF generated: {output_path}")
