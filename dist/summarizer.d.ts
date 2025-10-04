import type { CheckResult } from "./worker.js";
import type { AutoRule } from "./scanner.js";
import type { TaskQueue } from "./taskQueue.js";
export interface RuleSummary {
	rule: AutoRule;
	summary: string;
	totalChecked: number;
	passed: number;
	failed: number;
}
/**
 * Generate AI summary for a single rule using task queue
 */
export declare function generateSingleRuleSummary(
	ruleResults: CheckResult[],
	rule: AutoRule,
	apiKey: string,
	model: string,
	taskQueue: TaskQueue,
): Promise<RuleSummary>;
//# sourceMappingURL=summarizer.d.ts.map
