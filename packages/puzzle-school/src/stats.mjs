import { MATRIX } from "../data/matrix.mjs";
import { CONCEPT_GROUPS, STAGE_BANDS } from "./concepts.mjs";
import { bucketPuzzles } from "./bank.mjs";

/**
 * Matrix coverage report for a loaded bank.
 * @param {import('./bank.mjs').BankPuzzle[]} puzzles
 */
export function bankStats(puzzles) {
  const buckets = bucketPuzzles(puzzles);
  const byStage = Object.fromEntries(STAGE_BANDS.map((s) => [s.id, 0]));
  const byConcept = Object.fromEntries(CONCEPT_GROUPS.map((c) => [c.id, 0]));
  const matrix = [];

  for (const stage of STAGE_BANDS) {
    for (const concept of CONCEPT_GROUPS) {
      const key = `${stage.id}:${concept.id}`;
      const count = buckets.get(key)?.length ?? 0;
      matrix.push({ stage: stage.id, concept: concept.id, count });
      byStage[stage.id] += count;
      byConcept[concept.id] += count;
    }
  }

  const total = puzzles.length;
  const launchMin = MATRIX.launch.minPuzzleLessons;
  const stagesWithClasses = STAGE_BANDS.filter((s) => {
    const conceptsPopulated = CONCEPT_GROUPS.filter(
      (c) => (buckets.get(`${s.id}:${c.id}`)?.length ?? 0) >= 3,
    ).length;
    return conceptsPopulated >= MATRIX.stages[s.id].minClasses;
  }).length;

  return {
    total,
    launchMin,
    launchMet: total >= launchMin,
    byStage,
    byConcept,
    matrix,
    stagesWithMinClasses: stagesWithClasses,
    stagesRequired: STAGE_BANDS.length,
  };
}

/** @param {ReturnType<typeof bankStats>} stats */
export function printBankStats(stats) {
  const line = "═".repeat(50);
  console.log(`\n${line}`);
  console.log(" Puzzle School bank stats");
  console.log(line);
  console.log(`  Total puzzles:  ${stats.total.toLocaleString()}`);
  console.log(
    `  Launch bar:     ${stats.launchMin.toLocaleString()}  ${stats.launchMet ? "✓ met" : "✗ below"}`,
  );
  console.log(
    `  Stage coverage: ${stats.stagesWithMinClasses}/${stats.stagesRequired} stages with ≥3 concept buckets`,
  );
  console.log("\n  By stage:");
  for (const [stage, n] of Object.entries(stats.byStage)) {
    console.log(`    ${stage.padEnd(12)} ${n.toLocaleString()}`);
  }
  console.log("\n  By concept:");
  for (const [concept, n] of Object.entries(stats.byConcept)) {
    console.log(`    ${concept.padEnd(12)} ${n.toLocaleString()}`);
  }
  console.log(line);
}
