import { createThread, OpenRouter } from "@markwylde/ailib";
import {
	buildModelOptions,
	type ProviderSortOption,
} from "./modelOptions.js";
import type { AutoRule } from "./scanner.js";
import type { TaskQueue } from "./taskQueue.js";
import type { CheckResult } from "./worker.js";

export interface RuleSummary {
	rule: AutoRule;
	summary: string;
	totalChecked: number;
	passed: number;
	failed: number;
}

// ANSI color codes
const _colors = {
	reset: "\x1b[0m",
	bright: "\x1b[1m",
	cyan: "\x1b[36m",
	green: "\x1b[32m",
	yellow: "\x1b[33m",
	gray: "\x1b[90m",
};

/**
 * Generate AI summary for a single rule using task queue
 */
export async function generateSingleRuleSummary(
	ruleResults: CheckResult[],
	rule: AutoRule,
	apiKey: string,
	model: string,
	taskQueue: TaskQueue,
	providerOnly?: string,
	providerSort?: ProviderSortOption,
): Promise<RuleSummary> {
	return taskQueue.enqueue(async () => {
		return await _generateSummary(ruleResults, rule, apiKey, model, providerOnly, providerSort);
	});
}

/**
 * Internal summary generation
 */
async function _generateSummary(
	ruleResults: CheckResult[],
	rule: AutoRule,
	apiKey: string,
	model: string,
	providerOnly?: string,
	providerSort?: ProviderSortOption,
): Promise<RuleSummary> {
	const passed = ruleResults.filter((r) => r.passed).length;
	const failed = ruleResults.filter((r) => !r.passed).length;

	// Build summary prompt
	const resultsText = ruleResults
		.map(
			(r) =>
				`File: ${r.file}\nStatus: ${r.passed ? "PASSED" : "FAILED"}\nResponse: ${r.response}\n`,
		)
		.join("\n---\n");

	const prompt = `You are reviewing the results of an automated code quality check.

Rule: "${rule.title}"
Criteria: ${rule.criteria}

Results from ${ruleResults.length} files:
${resultsText}

Please provide a summary of the overall findings for this rule. Focus on the findings, the facts. It's not your job to solve or suggest fixes.

Write it in markdown.
`;

	const modelOptions = buildModelOptions(providerOnly, providerSort);

	const ai = createThread({
		provider: OpenRouter,
		model: model,
		messages: [{ role: "user", content: prompt }],
		apiKey: apiKey,
		...(modelOptions && { modelOptions }),
	});

	const stream = ai.messages.generate();
	let summary = "";

	await new Promise<void>((resolve, reject) => {
		stream.on("data", ([chunk]) => {
			summary += chunk;
		});
		stream.on("end", () => resolve());
		stream.on("error", (error) => reject(error));
	});

	return {
		rule,
		summary: summary.trim(),
		totalChecked: ruleResults.length,
		passed,
		failed,
	};
}
