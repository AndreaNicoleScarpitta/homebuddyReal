import { SeoPageLayout } from "@/components/seo-page-layout";
import { PAGE_SLUGS } from "@/lib/slug-registry";

export default function HomeInspection() {
  return (
    <SeoPageLayout
      slug={PAGE_SLUGS.guideHomeInspection}
      title="What to Fix First After a Home Inspection (A Real Story)"
      description="Learn how to prioritize your home inspection findings into a manageable plan. A step-by-step framework for separating urgent fixes from cosmetic issues."
      faq={[
        { question: "What should I fix first after a home inspection?", answer: "Prioritize safety hazards (electrical, active leaks, structural), then aging systems (HVAC, roof), then cosmetic issues last." },
        { question: "How do I prioritize home inspection findings?", answer: "Ask three questions: Is it dangerous? Will it get worse quickly? Will it be expensive if ignored? If yes, move it up the list." },
        { question: "Why do home inspection reports feel so overwhelming?", answer: "They're designed to catch everything — big issues, small issues, and someday issues. The result is everything feels equally urgent, but it's not." },
      ]}
    >
      <article className="space-y-8">
        <header>
          <h1 className="text-4xl font-heading font-bold tracking-tight mb-4">
            What to Fix First After a Home Inspection (A Real Story)
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed">
            We sat at the kitchen table staring at the inspection report like it had just insulted our intelligence.
          </p>
          <p className="text-lg text-muted-foreground leading-relaxed mt-4">
            My wife flipped through the pages and paused.
          </p>
          <p className="text-xl font-heading font-semibold text-foreground mt-4 italic">
            "Did we just make a huge mistake?"
          </p>
          <p className="text-lg text-muted-foreground leading-relaxed mt-4">
            It felt like we had bought a house… and a long list of problems.
          </p>
        </header>

        {/* Why Reports Feel Overwhelming */}
        <section>
          <h2 className="text-2xl font-heading font-semibold mt-12 mb-6 border-b pb-2">
            Why Inspection Reports Feel Overwhelming
          </h2>
          <p className="text-muted-foreground leading-relaxed mb-4">
            They're designed to catch everything:
          </p>
          <div className="rounded-lg bg-muted/30 p-6 space-y-3">
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>Big issues</li>
              <li>Small issues</li>
              <li>"Keep an eye on this someday" issues</li>
            </ul>
          </div>
          <p className="text-muted-foreground leading-relaxed mt-4">
            The result? Everything feels equally urgent.
          </p>
          <p className="text-muted-foreground leading-relaxed font-medium">
            It's not.
          </p>
        </section>

        {/* Step 1 */}
        <section>
          <h2 className="text-2xl font-heading font-semibold mt-12 mb-6 border-b pb-2">
            Step 1: Separate the Noise
          </h2>
          <p className="text-muted-foreground leading-relaxed mb-4">
            We broke everything into three categories.
          </p>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 p-5">
              <h3 className="font-heading font-semibold text-red-700 dark:text-red-400 mb-2">Fix Immediately</h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                <li>Electrical hazards</li>
                <li>Active leaks</li>
                <li>Structural concerns</li>
              </ul>
            </div>
            <div className="rounded-lg bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 p-5">
              <h3 className="font-heading font-semibold text-orange-700 dark:text-orange-400 mb-2">Fix Soon</h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                <li>Aging systems (HVAC, roof)</li>
                <li>Plumbing inefficiencies</li>
              </ul>
            </div>
            <div className="rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 p-5">
              <h3 className="font-heading font-semibold text-blue-700 dark:text-blue-400 mb-2">Fix Later</h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                <li>Cosmetic issues</li>
                <li>Minor wear and tear</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Step 2 */}
        <section>
          <h2 className="text-2xl font-heading font-semibold mt-12 mb-6 border-b pb-2">
            Step 2: Use a Priority Framework
          </h2>
          <p className="text-muted-foreground leading-relaxed mb-4">
            Ask:
          </p>
          <div className="rounded-lg bg-muted/30 p-6 space-y-3">
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>Is it dangerous?</li>
              <li>Will it get worse quickly?</li>
              <li>Will it be expensive if ignored?</li>
            </ul>
          </div>
          <p className="text-muted-foreground leading-relaxed mt-4">
            If yes → move it up.
          </p>
        </section>

        {/* Step 3 */}
        <section>
          <h2 className="text-2xl font-heading font-semibold mt-12 mb-6 border-b pb-2">
            Step 3: Turn It Into a Plan
          </h2>
          <p className="text-muted-foreground leading-relaxed mb-4">
            This is where everything changed for us.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            Once we organized it, the panic faded.
          </p>
          <p className="text-muted-foreground leading-relaxed mt-4">
            My wife looked at the list and said:
          </p>
          <p className="text-lg font-heading italic text-foreground mt-2">
            "Okay… this actually feels manageable."
          </p>
        </section>

        {/* What Most People Do */}
        <section>
          <h2 className="text-2xl font-heading font-semibold mt-12 mb-6 border-b pb-2">
            What Most People Do Instead
          </h2>
          <div className="rounded-lg bg-muted/30 p-6 space-y-3">
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>Fix one or two urgent things</li>
              <li>Forget the rest</li>
              <li className="text-orange-600 dark:text-orange-400">Rediscover problems later (expensively)</li>
            </ul>
          </div>
        </section>

        {/* What Works */}
        <section>
          <h2 className="text-2xl font-heading font-semibold mt-12 mb-6 border-b pb-2">
            What Actually Works
          </h2>
          <p className="text-muted-foreground leading-relaxed mb-4">
            You need:
          </p>
          <div className="rounded-lg bg-muted/30 p-6 space-y-3">
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>A prioritized list</li>
              <li>A timeline</li>
              <li>A system to track progress</li>
            </ul>
          </div>
          <p className="text-muted-foreground leading-relaxed mt-6">
            That's exactly what HomeBuddy does—it turns your inspection into a structured, manageable plan instead of a lingering source of stress.
          </p>
        </section>
      </article>
    </SeoPageLayout>
  );
}
