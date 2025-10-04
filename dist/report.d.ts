import type { CheckResult } from "./worker.js";
import type { AutoRule } from "./scanner.js";
import type { RuleSummary } from "./summarizer.js";
export declare function generateHTMLReport(
	results: CheckResult[],
	rules: AutoRule[],
	ruleSummaries: RuleSummary[],
	outputPath: string,
	options: {
		model: string;
		workers: number;
		duration: number;
	},
): Promise<void>;
//# sourceMappingURL=report.d.ts.map
