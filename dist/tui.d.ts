import type { AutoRule } from "./scanner.js";
import type { CheckResult } from "./worker.js";
import type { RuleSummary } from "./summarizer.js";
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
 * Render the TUI
 */
export declare function renderTUI(state: TUIState): void;
/**
 * Create initial TUI state
 */
export declare function createTUIState(
	workers: number,
	model: string,
	rules: AutoRule[],
	totalFiles: number,
): TUIState;
/**
 * Add a summary to the TUI state
 */
export declare function addSummary(state: TUIState, summary: RuleSummary): void;
/**
 * Update TUI state with a new result
 */
export declare function updateTUIState(
	state: TUIState,
	result: CheckResult,
): void;
/**
 * Mark TUI as completed
 */
export declare function completeTUI(state: TUIState): void;
//# sourceMappingURL=tui.d.ts.map
