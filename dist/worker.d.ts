import type { FileToCheck } from "./scanner.js";
import type { TaskQueue } from "./taskQueue.js";
export interface CheckResult {
	file: string;
	rule: string;
	ruleTitle: string;
	passed: boolean;
	response: string;
	error?: string;
	tokens?: number;
	cost?: number;
}
export interface WorkerOptions {
	apiKey: string;
	model?: string;
	rootDir: string;
}
/**
 * Check a single file against a rule using AI
 */
export declare function checkFile(
	fileToCheck: FileToCheck,
	options: WorkerOptions,
): Promise<CheckResult>;
/**
 * Process files using a global task queue
 */
export declare function processFiles(
	files: FileToCheck[],
	options: WorkerOptions,
	taskQueue: TaskQueue,
	onProgress: (
		result: CheckResult,
		completed: number,
		total: number,
	) => void | Promise<void>,
): Promise<CheckResult[]>;
//# sourceMappingURL=worker.d.ts.map
