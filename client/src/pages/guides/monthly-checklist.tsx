import { SeoPageLayout } from "@/components/seo-page-layout";
import { PAGE_SLUGS } from "@/lib/slug-registry";

const months = [
  { name: "January", tasks: ["Replace HVAC filter", "Check for drafts around windows and doors", "Inspect heating system performance"] },
  { name: "February", tasks: ["Test smoke and carbon monoxide detectors", "Check under sinks for leaks"] },
  { name: "March", tasks: ["Inspect roof for winter damage", "Test sump pump"] },
  { name: "April", tasks: ["Clean gutters", "Check exterior drainage"] },
  { name: "May", tasks: ["Service your air conditioning unit", "Inspect outdoor faucets"] },
  { name: "June", tasks: ["Check for pests", "Inspect attic ventilation"] },
  { name: "July", tasks: ["Clean dryer vent", "Check irrigation systems"] },
  { name: "August", tasks: ["Inspect windows and seals", "Test garage door safety"] },
  { name: "September", tasks: ["Replace HVAC filter", "Check insulation"] },
  { name: "October", tasks: ["Clean gutters (again)", "Winterize outdoor plumbing"] },
  { name: "November", tasks: ["Test heating system", "Inspect fireplace or chimney"] },
  { name: "December", tasks: ["Check for ice dam risks", "Inspect holiday lighting safety"] },
];

export default function MonthlyChecklist() {
  return (
    <SeoPageLayout
      slug={PAGE_SLUGS.guideMonthlyChecklist}
      title="Home Maintenance Checklist by Month (Because Your House Won't Text You)"
      description="A month-by-month home maintenance checklist that actually works. Stop guessing what your home needs — catch small problems before they become expensive surprises."
      faq={[
        { question: "Why do I need a monthly home maintenance checklist?", answer: "Most big repairs don't start big. A clogged filter becomes a burnt-out HVAC. A small leak becomes water damage. Monthly checklists help you catch problems early before they become expensive." },
        { question: "What home maintenance should I do every month?", answer: "At minimum, check HVAC filters, inspect for leaks, and do a quick walkthrough of your home's systems. Seasonal tasks like gutter cleaning and winterizing should follow the calendar." },
        { question: "What's the biggest home maintenance mistake?", answer: "Trying to remember everything mentally. You need a system that tracks and reminds you, not just knowledge." },
      ]}
    >
      <article className="space-y-8">
        <header>
          <h1 className="text-4xl font-heading font-bold tracking-tight mb-4" data-testid="text-monthly-checklist-title">
            Home Maintenance Checklist by Month
          </h1>
          <p className="text-xl font-heading text-muted-foreground italic mb-2">
            Because Your House Won't Text You
          </p>
          <p className="text-lg text-muted-foreground leading-relaxed mt-6">
            Owning a home is a bit like owning a very expensive pet that never makes eye contact.
          </p>
          <div className="text-lg text-muted-foreground leading-relaxed mt-4 space-y-1">
            <p>It won't tell you when it's uncomfortable.</p>
            <p>It won't remind you to take care of it.</p>
            <p>It will just… break.</p>
          </div>
          <p className="text-sm italic text-orange-600 dark:text-orange-400 mt-4">
            Usually at the worst possible time.
          </p>
          <p className="text-lg text-muted-foreground leading-relaxed mt-6">
            That's why having a home maintenance checklist by month isn't optional—it's survival.
          </p>
        </header>

        {/* Why Monthly Maintenance Matters */}
        <section>
          <h2 className="text-2xl font-heading font-semibold mt-12 mb-6 border-b pb-2">
            Why Monthly Home Maintenance Matters
          </h2>
          <p className="text-muted-foreground leading-relaxed mb-4">
            Most big repairs don't start big.
          </p>
          <div className="rounded-lg bg-muted/30 p-6 space-y-2">
            <p className="text-muted-foreground">A clogged filter becomes a <span className="text-orange-600 dark:text-orange-400 font-medium">burnt-out HVAC</span></p>
            <p className="text-muted-foreground">A small leak becomes <span className="text-orange-600 dark:text-orange-400 font-medium">water damage</span></p>
            <p className="text-muted-foreground">A loose shingle becomes a <span className="text-orange-600 dark:text-orange-400 font-medium">roof issue</span></p>
          </div>
          <p className="text-muted-foreground leading-relaxed mt-4">
            The goal isn't perfection. It's catching things early.
          </p>
        </section>

        {/* Month-by-Month Checklist */}
        <section>
          <h2 className="text-2xl font-heading font-semibold mt-12 mb-6 border-b pb-2">
            Your Month-by-Month Checklist
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {months.map((month) => (
              <div key={month.name} className="rounded-lg bg-muted/30 p-5" data-testid={`section-month-${month.name.toLowerCase()}`}>
                <h3 className="font-heading font-semibold text-foreground mb-3">{month.name}</h3>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                  {month.tasks.map((task, i) => (
                    <li key={i}>{task}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* Common Mistakes */}
        <section>
          <h2 className="text-2xl font-heading font-semibold mt-12 mb-6 border-b pb-2">
            Common Mistakes Homeowners Make
          </h2>
          <div className="rounded-lg bg-muted/30 p-6 space-y-3">
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>Waiting until something breaks</li>
              <li>Forgetting seasonal tasks</li>
              <li>Trying to remember everything mentally <span className="text-sm italic text-orange-600 dark:text-orange-400">(this never works)</span></li>
            </ul>
          </div>
        </section>

        {/* The Real Problem */}
        <section>
          <h2 className="text-2xl font-heading font-semibold mt-12 mb-6 border-b pb-2">
            The Real Problem Isn't Maintenance
          </h2>
          <p className="text-xl font-heading font-semibold text-foreground mb-4">
            It's tracking.
          </p>
          <p className="text-muted-foreground leading-relaxed mb-2">
            You don't need more knowledge.
          </p>
          <p className="text-muted-foreground leading-relaxed font-medium">
            You need a system that remembers for you.
          </p>
          <p className="text-muted-foreground leading-relaxed mt-6">
            That's exactly why I built HomeBuddy—it organizes everything your home needs, month by month, so nothing quietly turns into a $5,000 surprise.
          </p>
        </section>
      </article>
    </SeoPageLayout>
  );
}
