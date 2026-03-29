import { SeoPageLayout } from "@/components/seo-page-layout";
import { PAGE_SLUGS } from "@/lib/slug-registry";

export default function First90Days() {
  return (
    <SeoPageLayout
      slug={PAGE_SLUGS.guideFirst90Days}
      title="Just Bought a House? What to Do in the First 90 Days"
      description="A practical, week-by-week guide for new homeowners covering safety basics, understanding your house, and building maintenance momentum in the first 90 days."
    >
      <article className="space-y-8">
        <header>
          <h1 className="text-4xl font-heading font-bold tracking-tight mb-4">
            Just Bought a House? What to Do in the First 90 Days
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed">
            There's a weird moment after closing where the excitement fades and a new thought creeps in:
          </p>
          <p className="text-xl font-heading font-semibold text-foreground mt-4 italic">
            "Wait… I'm responsible for everything now?"
          </p>
          <p className="text-lg text-muted-foreground leading-relaxed mt-4">
            Yes. Yes you are.
          </p>
          <p className="text-lg text-muted-foreground leading-relaxed">
            But don't worry—there's a path through it.
          </p>
        </header>

        {/* Week 1 */}
        <section>
          <h2 className="text-2xl font-heading font-semibold mt-12 mb-6 border-b pb-2">
            Week 1: Lock In the Basics
          </h2>
          <p className="text-muted-foreground leading-relaxed mb-4">
            Start with control and safety:
          </p>
          <div className="rounded-lg bg-muted/30 p-6 space-y-3">
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>Change the locks</li>
              <li>Locate your main water shutoff</li>
              <li>Replace HVAC filter</li>
              <li>Test smoke and CO detectors</li>
            </ul>
          </div>
          <p className="text-muted-foreground leading-relaxed mt-4">
            You're not fixing everything—you're stabilizing your new environment.
          </p>
        </section>

        {/* First 30 Days */}
        <section>
          <h2 className="text-2xl font-heading font-semibold mt-12 mb-6 border-b pb-2">
            First 30 Days: Understand Your House
          </h2>
          <p className="text-muted-foreground leading-relaxed mb-4">
            This is where you shift from "owner" to "operator."
          </p>
          <div className="rounded-lg bg-muted/30 p-6 space-y-3">
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>Re-read your inspection report</li>
              <li>Identify urgent vs non-urgent issues</li>
              <li>Set up a basic maintenance schedule</li>
            </ul>
          </div>
          <p className="text-muted-foreground leading-relaxed mt-4">
            Most people skip this step.
          </p>
          <p className="text-muted-foreground leading-relaxed font-medium">
            They shouldn't.
          </p>
        </section>

        {/* Days 30-90 */}
        <section>
          <h2 className="text-2xl font-heading font-semibold mt-12 mb-6 border-b pb-2">
            Days 30–90: Build Momentum
          </h2>
          <p className="text-muted-foreground leading-relaxed mb-4">
            Now you:
          </p>
          <div className="rounded-lg bg-muted/30 p-6 space-y-3">
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>Address medium-priority fixes</li>
              <li>Start seasonal maintenance</li>
              <li>Learn how your systems behave</li>
            </ul>
          </div>
          <p className="text-muted-foreground leading-relaxed mt-4">
            This is when your home starts feeling… predictable.
          </p>
        </section>

        {/* Common Mistakes */}
        <section>
          <h2 className="text-2xl font-heading font-semibold mt-12 mb-6 border-b pb-2">
            What Most New Homeowners Get Wrong
          </h2>
          <p className="text-muted-foreground leading-relaxed mb-4">
            They assume:
          </p>
          <p className="text-lg font-heading italic text-foreground mb-4">
            "I'll just handle things as they come up"
          </p>
          <p className="text-sm italic text-orange-600 dark:text-orange-400">
            That turns into constant reaction mode.
          </p>
        </section>

        {/* Better Approach */}
        <section>
          <h2 className="text-2xl font-heading font-semibold mt-12 mb-6 border-b pb-2">
            The Better Approach
          </h2>
          <p className="text-muted-foreground leading-relaxed mb-4">
            Turn everything into a plan early:
          </p>
          <div className="rounded-lg bg-muted/30 p-6 space-y-3">
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>What needs to be done</li>
              <li>When it needs to happen</li>
              <li>What can wait</li>
            </ul>
          </div>
          <p className="text-muted-foreground leading-relaxed mt-6">
            HomeBuddy exists to make that simple—so your first year isn't just reacting to problems, but actually staying ahead of them.
          </p>
        </section>
      </article>
    </SeoPageLayout>
  );
}
