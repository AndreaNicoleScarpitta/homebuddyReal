import { SeoPageLayout } from "@/components/seo-page-layout";
import { PAGE_SLUGS } from "@/lib/slug-registry";

export default function PrintableSchedule() {
  return (
    <SeoPageLayout
      slug={PAGE_SLUGS.guidePrintableSchedule}
      title="Printable Home Maintenance Schedule (And Why It Usually Fails)"
      description="Why printable home maintenance checklists feel great but rarely work long-term, and what actually keeps homeowners on track."
      faq={[
        { question: "Why don't printable home maintenance checklists work?", answer: "Printables don't remind you, adapt to your home, or track what you've done. They're static, but your house is not." },
        { question: "What's better than a printable maintenance schedule?", answer: "A dynamic system that tracks your specific home systems, sends timely reminders, and evolves as your home ages." },
        { question: "What should a good home maintenance schedule include?", answer: "Monthly tasks (HVAC filter, quick inspections), quarterly tasks (gutters, water systems), and annual tasks (HVAC service, roof check)." },
      ]}
    >
      <article className="space-y-8">
        <header>
          <h1 className="text-4xl font-heading font-bold tracking-tight mb-4">
            Printable Home Maintenance Schedule (And Why It Usually Fails)
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed">
            There's something comforting about a printable checklist.
          </p>
          <p className="text-lg text-muted-foreground leading-relaxed mt-2">
            It feels organized. Responsible. In control.
          </p>
          <p className="text-lg text-muted-foreground leading-relaxed mt-4">
            And then…
          </p>
          <p className="text-xl font-heading font-semibold text-foreground mt-2">
            It disappears.
          </p>
        </header>

        {/* The Printable Fantasy */}
        <section>
          <h2 className="text-2xl font-heading font-semibold mt-12 mb-6 border-b pb-2">
            The Printable Fantasy
          </h2>
          <div className="rounded-lg bg-muted/30 p-6 space-y-3">
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
              <li>You print it.</li>
              <li>Maybe even highlight it.</li>
              <li>Promise yourself you'll follow it.</li>
            </ol>
          </div>
          <p className="text-sm italic text-orange-600 dark:text-orange-400 mt-4">
            Then life happens.
          </p>
        </section>

        {/* What a Good Schedule Includes */}
        <section>
          <h2 className="text-2xl font-heading font-semibold mt-12 mb-6 border-b pb-2">
            What a Good Schedule Includes
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg bg-muted/30 p-5">
              <h3 className="font-heading font-semibold text-foreground mb-3">Monthly</h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                <li>HVAC filter</li>
                <li>Quick inspections</li>
              </ul>
            </div>
            <div className="rounded-lg bg-muted/30 p-5">
              <h3 className="font-heading font-semibold text-foreground mb-3">Quarterly</h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                <li>Gutters</li>
                <li>Water systems</li>
              </ul>
            </div>
            <div className="rounded-lg bg-muted/30 p-5">
              <h3 className="font-heading font-semibold text-foreground mb-3">Annually</h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                <li>HVAC service</li>
                <li>Roof check</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Why Printables Fail */}
        <section>
          <h2 className="text-2xl font-heading font-semibold mt-12 mb-6 border-b pb-2">
            Why Printables Don't Work Long-Term
          </h2>
          <p className="text-muted-foreground leading-relaxed mb-4">
            They don't:
          </p>
          <div className="rounded-lg bg-muted/30 p-6 space-y-3">
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>Remind you</li>
              <li>Adapt to your home</li>
              <li>Track what you've done</li>
            </ul>
          </div>
          <p className="text-muted-foreground leading-relaxed mt-4">
            They're static.
          </p>
          <p className="text-muted-foreground leading-relaxed font-medium">
            Your house is not.
          </p>
        </section>

        {/* The Better Way */}
        <section>
          <h2 className="text-2xl font-heading font-semibold mt-12 mb-6 border-b pb-2">
            The Better Way
          </h2>
          <p className="text-muted-foreground leading-relaxed mb-4">
            You don't need paper.
          </p>
          <p className="text-muted-foreground leading-relaxed mb-4">
            You need:
          </p>
          <div className="rounded-lg bg-muted/30 p-6 space-y-3">
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>Dynamic tracking</li>
              <li>Timely reminders</li>
              <li>A system that evolves</li>
            </ul>
          </div>
        </section>

        {/* The Upgrade */}
        <section>
          <h2 className="text-2xl font-heading font-semibold mt-12 mb-6 border-b pb-2">
            The Upgrade
          </h2>
          <p className="text-muted-foreground leading-relaxed mb-4">
            That's exactly what HomeBuddy does.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            Instead of a checklist you forget, it becomes something that:
          </p>
          <div className="rounded-lg bg-primary/5 border border-primary/20 p-6 mt-4 space-y-3">
            <ul className="list-disc list-inside space-y-2 text-foreground">
              <li>Lives with your home</li>
              <li>Updates automatically</li>
              <li>Keeps you on track without effort</li>
            </ul>
          </div>
        </section>
      </article>
    </SeoPageLayout>
  );
}
