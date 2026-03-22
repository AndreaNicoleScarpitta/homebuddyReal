import { SeoPageLayout } from "@/components/seo-page-layout";
import { PAGE_SLUGS } from "@/lib/slug-registry";

const months = [
  {
    name: "January",
    tasks: [
      "Check weather stripping on all exterior doors and windows",
      "Test smoke and carbon monoxide detectors throughout the house",
      "Inspect exposed pipes for signs of freezing or condensation",
      "Clean the range hood filter and check exhaust fan operation",
      "Check attic for ice dams and ensure proper ventilation",
    ],
  },
  {
    name: "February",
    tasks: [
      "Service snow blower and other winter equipment",
      "Clean the dryer vent and lint trap thoroughly",
      "Test all GFCI outlets in kitchens, bathrooms, and exterior",
      "Check sump pump operation before spring thaw",
      "Inspect caulking around windows and reseal where needed",
    ],
  },
  {
    name: "March",
    tasks: [
      "Schedule HVAC service and replace filters for spring",
      "Clean gutters and downspouts of winter debris",
      "Inspect roof for damage from winter storms and ice",
      "Check exterior drainage and clear any blockages",
      "Test irrigation system and check for broken sprinkler heads",
    ],
  },
  {
    name: "April",
    tasks: [
      "Power wash siding, deck, and walkways",
      "Check window screens for tears and replace as needed",
      "Service lawn mower — sharpen blades, change oil, replace spark plug",
      "Inspect foundation for new cracks or signs of settling",
      "Fertilize lawn and begin spring landscaping",
    ],
  },
  {
    name: "May",
    tasks: [
      "Check AC refrigerant levels and schedule a tune-up",
      "Inspect deck and patio for loose boards or damaged surfaces",
      "Clean and arrange outdoor furniture for the season",
      "Check for termite damage around the foundation and wood structures",
      "Service sprinkler heads and adjust watering schedules",
    ],
  },
  {
    name: "June",
    tasks: [
      "Deep clean kitchen appliances — oven, dishwasher, refrigerator coils",
      "Inspect plumbing for leaks under sinks and around toilets",
      "Check attic ventilation to prevent summer heat buildup",
      "Service outdoor lighting and replace burnt-out bulbs",
      "Trim trees and shrubs away from the house and power lines",
    ],
  },
  {
    name: "July",
    tasks: [
      "Inspect grout and caulk in bathrooms and kitchen",
      "Flush the water heater to remove sediment buildup",
      "Check garage door balance and lubricate moving parts",
      "Clean ceiling fans and reverse direction for summer airflow",
      "Inspect exterior paint for peeling, cracking, or fading",
    ],
  },
  {
    name: "August",
    tasks: [
      "Test all smoke and carbon monoxide detectors — replace batteries",
      "Check weatherstripping and prepare for seasonal transition",
      "Inspect dryer vent for lint buildup and clear blockages",
      "Clean AC condenser unit and surrounding area",
      "Schedule furnace tune-up before the fall rush",
    ],
  },
  {
    name: "September",
    tasks: [
      "Service furnace and heating system for the cold months ahead",
      "Clean gutters and downspouts before fall leaves accumulate",
      "Seal driveway cracks and apply fresh sealant",
      "Check roof shingles and flashing for wear or damage",
      "Aerate lawn and apply fall fertilizer",
    ],
  },
  {
    name: "October",
    tasks: [
      "Winterize outdoor faucets and disconnect garden hoses",
      "Service fireplace and schedule chimney inspection and cleaning",
      "Reverse ceiling fans to clockwise for winter heating efficiency",
      "Insulate exposed pipes in unheated areas like basements and crawl spaces",
      "Rake leaves and apply winter fertilizer to the lawn",
    ],
  },
  {
    name: "November",
    tasks: [
      "Test heating system and check all vents for proper airflow",
      "Check attic and wall insulation — add more if needed",
      "Clean and service whole-house humidifier",
      "Stock up on winter supplies — salt, shovels, emergency kit",
      "Check for drafts around doors, windows, and electrical outlets",
    ],
  },
  {
    name: "December",
    tasks: [
      "Check holiday lighting for frayed wires and proper outdoor ratings",
      "Test backup sump pump and battery backup system",
      "Inspect ice dam prevention measures — heat cables, insulation",
      "Check fire extinguishers and verify they are fully charged",
      "Review yearly maintenance log and plan next year's schedule",
    ],
  },
];

export default function MonthlyChecklist() {
  return (
    <SeoPageLayout
      slug={PAGE_SLUGS.guideMonthlyChecklist}
      title="Home Maintenance Checklist by Month"
      description="Complete month-by-month home maintenance checklist. Know exactly what to inspect, clean, and service every month to protect your home investment."
    >
      <div className="space-y-8">
        <h1 className="text-4xl font-heading font-bold" data-testid="text-monthly-checklist-title">
          Home Maintenance Checklist by Month
        </h1>

        <p className="text-lg text-muted-foreground leading-relaxed">
          Staying on top of home maintenance doesn't have to be overwhelming. By spreading tasks across the calendar year, you can prevent costly emergency repairs, extend the life of your home's major systems, and protect one of your biggest financial investments. Use this month-by-month checklist to stay organized and proactive.
        </p>

        <div className="space-y-8">
          {months.map((month) => (
            <div key={month.name} className="p-6 rounded-lg bg-muted/30" data-testid={`section-month-${month.name.toLowerCase()}`}>
              <h2 className="text-2xl font-heading font-semibold border-b pb-2 mb-4">
                {month.name}
              </h2>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                {month.tasks.map((task, i) => (
                  <li key={i}>{task}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="p-6 rounded-lg bg-muted/30">
          <h2 className="text-2xl font-heading font-semibold border-b pb-2 mb-4">
            Track It All Automatically
          </h2>
          <p className="text-muted-foreground leading-relaxed">
            Generic checklists are a great starting point, but every home is different. Home Buddy generates a personalized maintenance schedule based on your specific home systems, appliance ages, and local climate — so you never have to reference a generic checklist again. Sign up and let your home tell you what it needs.
          </p>
        </div>
      </div>
    </SeoPageLayout>
  );
}
