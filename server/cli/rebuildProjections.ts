/**
 * CLI: Rebuild projection tables from event_log
 *
 * Replays all events from event_log (or from a specific --from-seq) and
 * recomputes every projection table from scratch.
 *
 * Usage:  npx tsx server/cli/rebuildProjections.ts [--from-seq=0]
 */

import { rebuildAll } from "../projections/rebuild";

const fromSeqArg = process.argv.find((a) => a.startsWith("--from-seq="));
const fromSeq = fromSeqArg ? Number(fromSeqArg.split("=")[1]) : 0;

console.warn(`[rebuildProjections] Starting rebuild from seq ${fromSeq}...`);

rebuildAll(fromSeq)
  .then(({ processed }) => {
    console.warn(`[rebuildProjections] Done. Processed ${processed} events.`);
    process.exit(0);
  })
  .catch((err) => {
    console.error("[rebuildProjections] Failed:", err);
    process.exit(1);
  });
