import { logInfo, logError } from "../logger";
import { runPreProcessor } from "./pre-processor";
import { runContractorAnalysis } from "./contractor-analysis";
import { runReasoningEngine } from "./reasoning-engine";
import type {
  AnalysisResult,
  ExistingSystem,
  ExistingTask,
  PreProcessorOutput,
  ProposedTask,
  SourceFileInfo,
} from "./types";

function extractSystemCategory(task: ProposedTask, pp: PreProcessorOutput): string {
  const titleLower = task.title.toLowerCase();
  const descLower = task.description.toLowerCase();
  const combined = titleLower + " " + descLower;

  const allCategories = new Set<string>();
  for (const i of pp.issuesDetected) allCategories.add(i.systemCategory);
  for (const r of pp.maintenanceRecommendations) allCategories.add(r.systemCategory);
  for (const s of pp.safetyFindings) allCategories.add(s.systemCategory);

  for (const cat of Array.from(allCategories)) {
    if (combined.includes(cat.toLowerCase())) return cat;
  }

  return "Unknown";
}

export async function runAnalysisPipeline(
  files: Array<{ text: string; fileName: string; fileType: string }>,
  existingSystems: ExistingSystem[],
  existingTasks: ExistingTask[],
  homeId: string,
  openaiConfig: { apiKey: string; baseURL: string }
): Promise<AnalysisResult> {
  const sourceFiles: SourceFileInfo[] = files.map((f) => ({
    fileName: f.fileName,
    fileType: f.fileType,
    textLength: f.text.length,
  }));

  logInfo("analysis-pipeline", "Starting 3-stage analysis pipeline", {
    homeId,
    fileCount: files.length,
    existingSystemCount: existingSystems.length,
  });

  const preProcessorOutput = await runPreProcessor(files, openaiConfig);

  logInfo("analysis-pipeline", "Pre-processor complete", {
    systems: preProcessorOutput.systemsDetected.length,
    issues: preProcessorOutput.issuesDetected.length,
    recommendations: preProcessorOutput.maintenanceRecommendations.length,
    attributes: preProcessorOutput.attributesDetected.length,
    safety: preProcessorOutput.safetyFindings.length,
  });

  const contractorOutput = runContractorAnalysis({
    preProcessorOutput,
    existingSystems,
    existingTasks,
    homeId,
  });

  logInfo("analysis-pipeline", "Contractor analysis complete", {
    matchedUpdates: contractorOutput.matchedSystemUpdates.length,
    matchedTasks: contractorOutput.matchedSystemTasks.length,
    suggestedSystems: contractorOutput.suggestedSystems.length,
  });

  const allExistingProposedTasks = [
    ...contractorOutput.matchedSystemTasks,
    ...contractorOutput.suggestedSystems.flatMap((s) => s.pendingTasks),
  ];

  const inferredTasks = runReasoningEngine(
    preProcessorOutput,
    allExistingProposedTasks,
    existingSystems
  );

  logInfo("analysis-pipeline", "Reasoning engine complete", {
    inferredTasks: inferredTasks.length,
  });

  for (const task of inferredTasks) {
    if (task.systemId) {
      contractorOutput.matchedSystemTasks.push(task);
    } else {
      const taskCatFromSource = extractSystemCategory(task, preProcessorOutput);
      const suggestion = contractorOutput.suggestedSystems.find(
        (s) => s.category.toLowerCase() === taskCatFromSource.toLowerCase() ||
               s.name.toLowerCase() === taskCatFromSource.toLowerCase()
      );
      if (suggestion) {
        task.suggestionId = suggestion.id;
        suggestion.pendingTasks.push(task);
      } else {
        logInfo("analysis-pipeline", "Dropping inferred task with no matching system or suggestion", {
          title: task.title,
          category: taskCatFromSource,
        });
      }
    }
  }

  const result: AnalysisResult = {
    matchedSystemUpdates: contractorOutput.matchedSystemUpdates,
    matchedSystemTasks: contractorOutput.matchedSystemTasks,
    suggestedSystems: contractorOutput.suggestedSystems,
    analysisWarnings: contractorOutput.warnings,
    sourceFiles,
  };

  logInfo("analysis-pipeline", "Analysis pipeline complete", {
    matchedUpdates: result.matchedSystemUpdates.length,
    matchedTasks: result.matchedSystemTasks.length,
    suggestedSystems: result.suggestedSystems.length,
    totalWarnings: result.analysisWarnings.length,
  });

  return result;
}
