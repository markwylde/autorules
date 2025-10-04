#!/usr/bin/env node

import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { generateHTMLReport } from "./report.js";
import { scanProject } from "./scanner.js";
import { generateSingleRuleSummary } from "./summarizer.js";
import { TaskQueue } from "./taskQueue.js";
import {
	ProviderSortOption,
	VALID_PROVIDER_SORTS,
} from "./modelOptions.js";
import {
	addSummary,
	completeTUI,
	createTUIState,
	updateTUIState,
} from "./tui.js";
import { type CheckResult, processFiles } from "./worker.js";

async function main() {
	// Parse command line arguments
	const { values } = parseArgs({
		options: {
			workers: {
				type: "string",
				short: "w",
				default: "3",
			},
			report: {
				type: "string",
				short: "r",
				default: "html",
			},
			model: {
				type: "string",
				short: "m",
				default: "openai/gpt-5-mini",
			},
			"api-key": {
				type: "string",
				short: "k",
			},
			output: {
				type: "string",
				short: "o",
				default: "autorules-report.html",
			},
			provider: {
				type: "string",
			},
			"provider-sort": {
				type: "string",
			},
			help: {
				type: "boolean",
				short: "h",
			},
		},
	});

	if (values.help) {
		console.log(`
AutoRules AI - Automated code quality checking with AI

Usage: autorules [options]

Options:
  -w, --workers <number>     Number of parallel workers (default: 3)
  -r, --report <format>      Report format: html (default: html)
  -m, --model <model>        AI model to use (default: anthropic/claude-3.5-sonnet)
  -k, --api-key <key>        OpenRouter API key (or set OPENROUTER_API_KEY env var)
  -o, --output <path>        Output path for report (default: autorules-report.html)
  --provider <name>          Filter to only use specific provider (e.g., Cerebras)
  --provider-sort <method>   Sort providers by method (e.g., throughput)
  -h, --help                 Show this help message

Examples:
  autorules --workers=5 --model=openai/gpt-5-mini
  autorules --report=html --output=./reports/results.html
  autorules --provider=Cerebras --provider-sort=throughput
  OPENROUTER_API_KEY=xxx autorules
`);
		process.exit(0);
	}

	// Get API key
	const apiKey =
		(values["api-key"] as string) || process.env.OPENROUTER_API_KEY;
	if (!apiKey) {
		console.error(
			"Error: API key is required. Set OPENROUTER_API_KEY environment variable or use --api-key option.",
		);
		process.exit(1);
	}

	const workers = parseInt(values.workers as string, 10);
	const model = values.model as string;
	const outputPath = resolve(values.output as string);
	const rootDir = process.cwd();
	const providerOnly = values.provider as string | undefined;
	const providerSortArg = values["provider-sort"] as string | undefined;
	let providerSort: ProviderSortOption | undefined;

	if (providerSortArg) {
		if (
			VALID_PROVIDER_SORTS.includes(
				providerSortArg as ProviderSortOption,
			)
		) {
			providerSort = providerSortArg as ProviderSortOption;
		} else {
			console.warn(
				`Warning: Invalid provider sort "${providerSortArg}". Valid options: ${VALID_PROVIDER_SORTS.join(", ")}.`,
			);
		}
	}

	console.log("Scanning for autorules...\n");

	// Scan project
	const { files, rules } = await scanProject(rootDir);

	if (rules.length === 0) {
		console.error("No autorules found in the project.");
		process.exit(1);
	}

	if (files.length === 0) {
		console.error("No files found matching the autorules patterns.");
		process.exit(1);
	}

	console.log(
		`Found ${rules.length} rule(s) and ${files.length} file(s) to check.\n`,
	);

	// Create global task queue
	const taskQueue = new TaskQueue(workers);

	// Create TUI state
	const tuiState = createTUIState(workers, model, rules, files.length);
	const startTime = Date.now();

	// Track results by rule to detect completion
	const ruleResultsMap = new Map<string, CheckResult[]>(
		rules.map((r) => [r.title, []]),
	);
	const ruleFileCounts = new Map(
		rules.map((r) => [
			r.title,
			files.filter((f) => f.rule.title === r.title).length,
		]),
	);
	const ruleSummaryGenerated = new Set<string>();

	// Process files using task queue
	const results = await processFiles(
		files,
		{ apiKey, model, rootDir, providerOnly, providerSort },
		taskQueue,
		async (result, _completed, _total) => {
			updateTUIState(tuiState, result);

			// Track results by rule
			ruleResultsMap.get(result.ruleTitle)?.push(result);

			// Check if this rule is now complete
			const ruleResults = ruleResultsMap.get(result.ruleTitle) || [];
			const expectedCount = ruleFileCounts.get(result.ruleTitle) || 0;

			if (
				ruleResults.length === expectedCount &&
				!ruleSummaryGenerated.has(result.ruleTitle)
			) {
				// Mark as generating to prevent duplicates
				ruleSummaryGenerated.add(result.ruleTitle);

				// Generate summary for this rule (queued in task pool)
				const rule = rules.find((r) => r.title === result.ruleTitle);
				if (rule) {
					generateSingleRuleSummary(
						ruleResults,
						rule,
						apiKey,
						model,
						taskQueue,
						providerOnly,
						providerSort,
					).then((summary) => {
						addSummary(tuiState, summary);
					});
				}
			}
		},
	);

	// Wait for all summaries to complete
	await taskQueue.drain();

	// Complete TUI
	completeTUI(tuiState);

	const duration = Math.floor((Date.now() - startTime) / 1000);

	// Get summaries from TUI state
	const summaries = Array.from(tuiState.summaries.values());

	// Generate report
	if (values.report === "html") {
		console.log(`${"\x1b[36m"}Generating HTML report...${"\x1b[0m"}`);
		await generateHTMLReport(results, rules, summaries, outputPath, {
			model,
			workers,
			duration,
		});
		console.log(`${"\x1b[32m"}✓ Report saved to ${outputPath}${"\x1b[0m"}\n`);
	}

	// Summary
	const failures = results.filter((r) => !r.passed).length;
	const passed = results.filter((r) => r.passed).length;

	console.log(`\nSummary:`);
	console.log(`  Total: ${results.length}`);
	console.log(`  Passed: ${passed}`);
	console.log(`  Failed: ${failures}`);

	// Exit with error code if there are failures
	process.exit(failures > 0 ? 1 : 0);
}

main().catch((error) => {
	console.error("Fatal error:", error);
	process.exit(1);
});
