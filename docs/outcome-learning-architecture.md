# Outcome Learning Engine Architecture

## How Feedback Improves Predictions

The learning engine closes the loop: **recommendation → action → outcome → calibration**.

```
Intelligence Layer → Recommendation to user
                          ↓
User records action (completed, deferred, hired pro, ignored)
                          ↓
Time passes → User records outcome (avoided issue, failure, improved, no change)
                          ↓
Learning Engine analyzes: Did prediction match reality?
                          ↓
Adjustments applied → Intelligence Layer is now more accurate
```

Every action and outcome creates a timeline event, building the home's story.

## How Data Compounds Over Time

Each cycle adds signal:

| Data Points | Confidence | Behavior |
|-------------|-----------|----------|
| 0-2 | Low (10-30%) | Default parameters |
| 3-5 | Medium (30-60%) | Behavior pattern emerges |
| 6-10 | Good (60-80%) | Per-system adjustments |
| 10+ | High (80%+) | Personalized predictions |

More homes = better baseline reliability profiles. More actions per home = better personalization.

## How This Becomes a Long-Term Moat

1. **Proprietary reliability data**: Every outcome teaches us how long systems actually last in real homes
2. **Behavior-adjusted predictions**: No one else has "this homeowner's maintenance habits reduce HVAC risk by 15%"
3. **Regional patterns**: Over time, aggregate data reveals regional failure patterns (climate, soil, water quality)
4. **Cost accuracy**: Actual repair/replacement costs improve cost forecasting
5. **Compounding accuracy**: Each cycle makes the next prediction more accurate

## System Design

### Tables
- `user_actions` — What the user did (completed_task, hired_contractor, deferred, ignored)
- `outcome_events` — What actually happened (failure, avoided_issue, improved, degraded, no_change)
- `learning_adjustments` — Calibrated parameters per home (risk factor, lifecycle shifts, maintenance weights)

### Behavior Analysis
Users are classified as:
- **Proactive** (≥70% compliance): Risk reduced by 15%
- **Reactive** (40-70% compliance): Risk increased by 5%
- **Neglectful** (<40% compliance): Risk increased by 20%

### Per-System Reliability
For each system category with ≥2 outcomes:
- Average failure age (observed vs expected)
- Maintenance impact score (how much maintenance helps)
- Variance and confidence

### Adjustment Application
Learning adjustments modify the prediction engine via a `riskAdjustmentFactor`:
- Applied as a multiplier to failure probability
- Loaded at query time (always current)
- Non-fatal: if loading fails, defaults to 1.0 (no adjustment)

## Evolution Path

### Current: Rule-Based Statistical Adjustments
- Weighted averages from outcome history
- Simple compliance rate calculation
- Per-category reliability profiles

### Next: Cross-Home Learning
- Aggregate reliability profiles across all homes
- Regional adjustment factors
- System-specific failure curves from real data

### Future: ML Integration
- Survival analysis models trained on outcome data
- Feature engineering from the full Home Graph
- Time-series prediction with seasonal patterns
- Anomaly detection for unusual degradation

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/v2/homes/:id/actions` | POST | Record user action |
| `/v2/homes/:id/outcomes` | POST | Record system outcome |
| `/v2/homes/:id/actions` | GET | List actions |
| `/v2/homes/:id/outcomes` | GET | List outcomes |
| `/v2/homes/:id/learning-summary` | GET | Full learning analysis |

## UX Principles

1. **Learning is quiet** — The engine calibrates in the background
2. **Actions are lightweight** — 2-tap recording (what did you do? → save)
3. **Positive reinforcement** — "You avoided X issues" card
4. **No complexity exposed** — Users see "75% compliance" not "riskAdjustmentFactor: 0.85"
5. **Optional but encouraged** — System works without feedback, gets better with it
