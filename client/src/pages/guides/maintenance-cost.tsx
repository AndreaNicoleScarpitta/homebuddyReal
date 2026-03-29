import { SeoPageLayout } from "@/components/seo-page-layout";
import { PAGE_SLUGS } from "@/lib/slug-registry";

export default function MaintenanceCost() {
  return (
    <SeoPageLayout
      slug={PAGE_SLUGS.guideMaintenanceCost}
      title="How Much Does Home Maintenance Cost Per Year?"
      description="The real cost of home maintenance, the 1-3% rule of thumb, where the money goes, and how to plan ahead so nothing feels like a financial ambush."
      faq={[
        { question: "How much should I budget for home maintenance per year?", answer: "The rule of thumb is 1-3% of your home's value per year. For a $400,000 home, that's $4,000-$12,000 annually." },
        { question: "Where does most home maintenance money go?", answer: "HVAC servicing and replacement, roof maintenance, plumbing issues, and appliance failures are the biggest categories." },
        { question: "Why do home maintenance costs feel unpredictable?", answer: "Costs aren't evenly spaced. You might pay nothing for months, then suddenly face a $6,000 bill. The key is tracking system lifespans and budgeting proactively." },
      ]}
    >
      <article className="space-y-8">
        <header>
          <h1 className="text-4xl font-heading font-bold tracking-tight mb-4">
            How Much Does Home Maintenance Cost Per Year?
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Owning a home has a hidden subscription fee.
          </p>
          <p className="text-lg text-muted-foreground leading-relaxed mt-2">
            It just doesn't show up as a monthly bill.
          </p>
        </header>

        {/* Rule of Thumb */}
        <section>
          <h2 className="text-2xl font-heading font-semibold mt-12 mb-6 border-b pb-2">
            The Rule of Thumb
          </h2>
          <p className="text-muted-foreground leading-relaxed mb-4">
            Expect:
          </p>
          <div className="rounded-lg bg-primary/5 border border-primary/20 p-6">
            <p className="text-2xl font-heading font-bold text-foreground text-center">
              1–3% of your home's value per year
            </p>
          </div>
          <div className="rounded-lg bg-muted/30 p-6 mt-4">
            <p className="text-muted-foreground">
              <span className="font-semibold text-foreground">Example:</span>{" "}
              $400,000 home → $4,000–$12,000 annually
            </p>
          </div>
        </section>

        {/* Where Money Goes */}
        <section>
          <h2 className="text-2xl font-heading font-semibold mt-12 mb-6 border-b pb-2">
            Where the Money Goes
          </h2>
          <div className="rounded-lg bg-muted/30 p-6 space-y-3">
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>HVAC servicing and replacement</li>
              <li>Roof maintenance</li>
              <li>Plumbing issues</li>
              <li>Appliance failures</li>
            </ul>
          </div>
          <p className="text-muted-foreground leading-relaxed mt-4">
            And occasionally:
          </p>
          <p className="text-sm italic text-orange-600 dark:text-orange-400 mt-2">
            "I did not plan for this at all"
          </p>
        </section>

        {/* The Real Problem */}
        <section>
          <h2 className="text-2xl font-heading font-semibold mt-12 mb-6 border-b pb-2">
            The Real Problem
          </h2>
          <p className="text-muted-foreground leading-relaxed mb-4">
            Costs aren't evenly spaced.
          </p>
          <div className="grid gap-4 md:grid-cols-2 mt-4">
            <div className="rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 p-5">
              <p className="text-sm text-muted-foreground">You won't pay:</p>
              <p className="text-lg font-heading font-semibold text-green-700 dark:text-green-400 mt-1">$500 every month</p>
            </div>
            <div className="rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 p-5">
              <p className="text-sm text-muted-foreground">You'll pay:</p>
              <p className="text-lg font-heading font-semibold text-red-700 dark:text-red-400 mt-1">Nothing for months — then suddenly $6,000</p>
            </div>
          </div>
        </section>

        {/* Smart Homeowners */}
        <section>
          <h2 className="text-2xl font-heading font-semibold mt-12 mb-6 border-b pb-2">
            What Smart Homeowners Do
          </h2>
          <p className="text-muted-foreground leading-relaxed mb-4">
            They plan ahead by:
          </p>
          <div className="rounded-lg bg-muted/30 p-6 space-y-3">
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>Tracking system lifespans</li>
              <li>Anticipating replacements</li>
              <li>Budgeting proactively</li>
            </ul>
          </div>
        </section>

        {/* Stress vs Control */}
        <section>
          <h2 className="text-2xl font-heading font-semibold mt-12 mb-6 border-b pb-2">
            The Difference Between Stress and Control
          </h2>
          <p className="text-muted-foreground leading-relaxed mb-2">
            It's not how much you spend.
          </p>
          <p className="text-muted-foreground leading-relaxed font-medium">
            It's whether you saw it coming.
          </p>
          <p className="text-muted-foreground leading-relaxed mt-6">
            HomeBuddy helps you track what's aging, what's coming up, and what to expect—so nothing feels like a financial ambush.
          </p>
        </section>
      </article>
    </SeoPageLayout>
  );
}
