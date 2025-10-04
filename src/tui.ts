import type { AutoRule } from "./scanner.js";
import type { RuleSummary } from "./summarizer.js";
import type { CheckResult } from "./worker.js";

// ANSI color codes
const colors = {
	reset: "\x1b[0m",
	bright: "\x1b[1m",
	dim: "\x1b[2m",

	// Foreground colors
	cyan: "\x1b[36m",
	green: "\x1b[32m",
	red: "\x1b[31m",
	yellow: "\x1b[33m",
	blue: "\x1b[34m",
	magenta: "\x1b[35m",
	gray: "\x1b[90m",
	white: "\x1b[37m",

	// Background colors
	bgCyan: "\x1b[46m",
	bgGreen: "\x1b[42m",
	bgRed: "\x1b[41m",
	bgYellow: "\x1b[43m",
};

export interface TUIState {
	status: "Scanning" | "Processing" | "Completed" | "Failed";
	startTime: number;
	workers: number;
	model: string;
	rules: AutoRule[];
	results: CheckResult[];
	summaries: Map<string, RuleSummary>;
	totalFiles: number;
	completedFiles: number;
	failures: number;
	totalTokens: number;
	totalCost: number;
}

/**
 * Format time duration in seconds
 */
function formatDuration(ms: number): number {
	return Math.floor(ms / 1000);
}

/**
 * Create a progress bar
 */
function createProgressBar(
	completed: number,
	total: number,
	width: number = 30,
): string {
	const percentage = total === 0 ? 0 : completed / total;
	const filled = Math.floor(percentage * width);
	const empty = width - filled;

	const bar = "█".repeat(filled) + "░".repeat(empty);
	const color =
		percentage === 1
			? colors.green
			: percentage > 0.5
				? colors.cyan
				: colors.yellow;

	return `${color}${bar}${colors.reset}`;
}

/**
 * Calculate ETA
 */
function calculateETA(state: TUIState): number {
	const elapsed = Date.now() - state.startTime;
	const rate = state.completedFiles / elapsed; // files per ms

	if (rate === 0) return 0;

	const remaining = state.totalFiles - state.completedFiles;
	return Math.floor(remaining / rate / 1000); // seconds
}

/**
 * Group results by rule
 */
function groupResultsByRule(
	results: CheckResult[],
): Map<string, CheckResult[]> {
	const grouped = new Map<string, CheckResult[]>();

	for (const result of results) {
		const key = result.ruleTitle;
		if (!grouped.has(key)) {
			grouped.set(key, []);
		}
		grouped.get(key)?.push(result);
	}

	return grouped;
}

/**
 * Render the TUI
 */
export function renderTUI(state: TUIState): void {
	// Clear console
	console.clear();

	const elapsed = formatDuration(Date.now() - state.startTime);
	const eta = calculateETA(state);

	// Header with colors
	console.log(`${colors.cyan}${"═".repeat(80)}${colors.reset}`);
	console.log(
		`${colors.bright}${colors.cyan}  AutoRules AI${colors.reset}${colors.gray} - Automated Code Quality Checks${colors.reset}`,
	);
	console.log(`${colors.cyan}${"═".repeat(80)}${colors.reset}\n`);

	// Status info
	const statusColor =
		state.status === "Completed"
			? colors.green
			: state.status === "Failed"
				? colors.red
				: colors.yellow;

	console.log(
		`  ${colors.bright}Status:${colors.reset} ${statusColor}${state.status}${colors.reset}`,
	);
	console.log(
		`  ${colors.bright}Time:${colors.reset} ${colors.cyan}${elapsed}s${colors.reset}${eta > 0 ? ` ${colors.gray}(${eta}s remaining)${colors.reset}` : ""}`,
	);
	console.log(
		`  ${colors.bright}Workers:${colors.reset} ${colors.cyan}${state.workers}${colors.reset} | ${colors.bright}Model:${colors.reset} ${colors.magenta}${state.model}${colors.reset}`,
	);
	console.log(
		`  ${colors.bright}Tokens:${colors.reset} ${colors.cyan}${state.totalTokens.toLocaleString()}${colors.reset} | ${colors.bright}Cost:${colors.reset} ${colors.green}$${state.totalCost.toFixed(6)}${colors.reset}\n`,
	);

	// Group results by rule
	const grouped = groupResultsByRule(state.results);

	// Show progress for each rule
	console.log(`${colors.bright}${colors.white}Rules:${colors.reset}\n`);

	let index = 1;
	for (const rule of state.rules) {
		const ruleResults = grouped.get(rule.title) || [];
		const completed = ruleResults.length;
		const total = state.totalFiles / state.rules.length; // Approximate
		const failures = ruleResults.filter((r) => !r.passed).length;
		const summary = state.summaries.get(rule.title);

		const ruleColor = failures > 0 ? colors.red : colors.green;
		const percentage = Math.floor((completed / total) * 100);

		console.log(
			`  ${colors.bright}${index}.${colors.reset} ${ruleColor}${rule.title}${colors.reset}`,
		);
		console.log(`     ${colors.gray}${rule.rulePath}${colors.reset}`);
		console.log(
			`     ${createProgressBar(completed, total)} ${colors.cyan}${percentage}%${colors.reset} ${colors.gray}(${completed}/${Math.floor(total)} files${colors.reset}${failures > 0 ? ` ${colors.red}| ${failures} failures${colors.reset}` : `${colors.reset}`}${colors.gray})${colors.reset}`,
		);

		// Show summary status if available
		if (summary) {
			console.log(`     ${colors.green}✓ Summary generated${colors.reset}`);
		} else if (completed === total) {
			console.log(
				`     ${colors.yellow}⟳ Generating summary...${colors.reset}`,
			);
		}
		console.log("");

		index++;
	}

	console.log(`${colors.cyan}${"═".repeat(80)}${colors.reset}`);
}

/**
 * Create initial TUI state
 */
export function createTUIState(
	workers: number,
	model: string,
	rules: AutoRule[],
	totalFiles: number,
): TUIState {
	return {
		status: "Processing",
		startTime: Date.now(),
		workers,
		model,
		rules,
		results: [],
		summaries: new Map(),
		totalFiles,
		completedFiles: 0,
		failures: 0,
		totalTokens: 0,
		totalCost: 0,
	};
}

/**
 * Add a summary to the TUI state
 */
export function addSummary(state: TUIState, summary: RuleSummary): void {
	state.summaries.set(summary.rule.title, summary);
	renderTUI(state);
}

/**
 * Update TUI state with a new result
 */
export function updateTUIState(state: TUIState, result: CheckResult): void {
	state.results.push(result);
	state.completedFiles++;

	if (!result.passed) {
		state.failures++;
	}

	if (result.tokens) {
		state.totalTokens += result.tokens;
	}

	if (result.cost) {
		state.totalCost += result.cost;
	}

	renderTUI(state);
}

/**
 * Mark TUI as completed
 */
export function completeTUI(state: TUIState): void {
	state.status = "Completed";
	renderTUI(state);
}
