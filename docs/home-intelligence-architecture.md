# Home Intelligence Architecture

## How Intelligence is Computed

The system uses a three-layer architecture:

```
Rules Engine (pure functions, no DB)
    ↓
Intelligence Engine (orchestrator, loads from DB)
    ↓
Prediction Engine (probabilistic forecasting)
```

All computation is **deterministic, on-the-fly** — no stored intelligence, no LLM calls. Every result is explainable.

## Rules Engine (`server/services/rules-engine.ts`)

Seven modular rules, each a pure function `(SystemContext) → RuleResult`:

| Rule | What it checks | Risk impact |
|------|---------------|-------------|
| `ageRiskRule` | System age vs. expected lifespan | +20 at 75%, +40 at 90% |
| `maintenanceGapRule` | Last service date gap | +15 (HVAC 12mo), +10 (others 24mo) |
| `warrantyExpiryRule` | Warranty expiration proximity | Informational finding |
| `conditionDegradationRule` | System/component condition | +30 (Poor), +15 (Fair) |
| `repairFrequencyRule` | Recent repair clustering | +15 (2 repairs), +25 (3+) |
| `missingDataRule` | Data completeness | Confidence penalty (-30 to -5) |
| `costTrendRule` | Repair costs vs. replacement | +10 if approaching replacement cost |

### Lifecycle Heuristics

Static data map keyed by `category/material`:
- Roof/Asphalt: 20-30 years
- HVAC: 15-20 years
- Water Heater/Tank: 8-12 years
- Plumbing/Copper: 50-70 years
- And 20+ more entries

## How Confidence is Derived

Confidence starts at 100 and is reduced by missing data:
- No install year and no home built year: -30
- No condition or condition "Unknown": -20
- No last service date: -10
- No material specified: -5

Minimum confidence floor: 10.

## Prediction Engine (`server/services/prediction-engine.ts`)

### Failure Probability

Uses a **logistic curve** centered at 85% of lifespan:

```
P(failure) = 1 / (1 + e^(-10 * (ageRatio - 0.85)))
```

Modifiers:
- Poor condition: +0.2
- Fair condition: +0.1
- Great condition: -0.1
- 2+ recent repairs: +0.1
- 24-month window: `1 - (1-P)²`

### Cost Modeling

Static cost ranges per system type (in cents):
- Repair ranges: $100-$5,000 depending on type
- Replacement ranges: $500-$30,000 depending on type

### Cost of Inaction

Combines failure probability with cost ranges to produce:
- "There's roughly a 35% chance your HVAC system could need $300-$8,000 in work within 12 months."
- Recommended action window based on probability thresholds

## How Health Score Works

Weighted average of `(100 - riskLevel)` across all systems:

| System Type | Weight |
|-------------|--------|
| Roof, Foundation, Electrical | 1.5x |
| HVAC, Plumbing, Water Heater | 1.2x |
| Windows, Siding, Chimney | 1.0x |
| Appliances | 0.8x |
| Landscaping, Paint, Pest | 0.5-0.6x |

## API Endpoints

- `GET /v2/homes/:homeId/intelligence` — Full home intelligence (insight + forecast + per-system details)
- `GET /v2/systems/:systemId/insight` — Single system insight with prediction, cost projection, inaction analysis

Both computed on-the-fly from current graph data.

## Evolution Path

### Phase 2: ML Integration
- Replace logistic curve with trained survival models
- Use repair/replacement history as training data across homes
- Climate-adjusted predictions (temperature, humidity, storm frequency)

### Phase 3: External Data
- Insurance claims data for failure rates
- Local contractor pricing data for cost accuracy
- Building code changes affecting compliance requirements
- Weather history for damage correlation

### Phase 4: Continuous Learning
- Track prediction accuracy over time (predicted vs. actual failures)
- Auto-tune rule weights based on outcomes
- Personalize predictions per home (local microclimate, usage patterns)

## Key Design Decisions

1. **No LLM dependency** — All logic is deterministic rules. Auditable, explainable, fast.
2. **Compute on-the-fly** — No stored intelligence. Always reflects current data.
3. **Ranges not points** — Costs are always ranges, never fake precision.
4. **Human language** — All findings use homeowner-friendly language.
5. **Modular rules** — Each rule is independent, composable, easy to add/remove.
6. **Confidence scoring** — Every insight includes confidence based on data completeness.
