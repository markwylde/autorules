import { readFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { createThread, OpenRouter } from "@markwylde/ailib";
import { buildModelOptions, type ProviderSortOption } from "./modelOptions.js";
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
	providerOnly?: string;
	providerSort?: ProviderSortOption;
}

/**
 * Check a single file against a rule using AI
 */
export async function checkFile(
	fileToCheck: FileToCheck,
	options: WorkerOptions,
): Promise<CheckResult> {
	const { path, rule } = fileToCheck;
	const relativePath = relative(options.rootDir, path);

	try {
		// Read the file content
		const content = await readFile(path, "utf-8");

		// Read included file if specified
		let includesContent = "";
		if (rule.includes) {
			try {
				const ruleDir = dirname(rule.rulePath);
				const includesPath = resolve(ruleDir, rule.includes);
				const includesFileContent = await readFile(includesPath, "utf-8");
				includesContent = `File: ${rule.includes}
Content:
\`\`\`
${includesFileContent}
\`\`\`

---

`;
			} catch (error) {
				// If the includes file cannot be read, continue without it
				console.warn(
					`Warning: Could not read includes file ${rule.includes}: ${error instanceof Error ? error.message : String(error)}`,
				);
			}
		}

		// Build the prompt
		const prompt = `FILENAME: ${relativePath}
CONTENT: application/text
---
${content}
---

You are part of a system that is being asked to check every single file in a project a question.

You have been chosen to analyse \`${relativePath}\`.

The criteria you are to assess the file on is:

${includesContent}> ${rule.criteria}

Your response will not get directly sent to the user, but instead will be combined with the responses of every other files generated.

So please keep your answer short. If this file does not raise any concerns/problems that the users has asked, then just return "This passes your criteria".

If there are causes for concern, list exactly what part failed and why you concluded that it failed.`;

		const modelOptions = buildModelOptions(
			options.providerOnly,
			options.providerSort,
		);

		// Create AI thread
			const ai = createThread({
				provider: OpenRouter,
				model: options.model || "openai/gpt-oss-120b",
			messages: [{ role: "user", content: prompt }],
			apiKey: options.apiKey,
			...(modelOptions && { modelOptions }),
		});

		// Generate response
		const stream = ai.messages.generate();

		let response = "";
		await new Promise<void>((resolve, reject) => {
			stream.on("data", ([chunk]) => {
				response += chunk;
			});

			stream.on("end", () => {
				resolve();
			});

			stream.on("error", (error) => {
				reject(error);
			});
		});

		// Determine if it passed (simple heuristic: if response starts with "This passes")
		const passed = response.trim().startsWith("This passes");

		// Get the last message for token/cost info
		const lastMessage = ai.messages.list[ai.messages.list.length - 1];

		return {
			file: relativePath,
			rule: rule.rulePath,
			ruleTitle: rule.title,
			passed,
			response: response.trim(),
			tokens: lastMessage.tokens,
			cost: lastMessage.cost,
		};
	} catch (error) {
		return {
			file: relativePath,
			rule: rule.rulePath,
			ruleTitle: rule.title,
			passed: false,
			response: "",
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

/**
 * Process files using a global task queue
 */
export async function processFiles(
	files: FileToCheck[],
	options: WorkerOptions,
	taskQueue: TaskQueue,
	onProgress: (
		result: CheckResult,
		completed: number,
		total: number,
	) => void | Promise<void>,
): Promise<CheckResult[]> {
	const results: CheckResult[] = [];
	let completed = 0;
	const total = files.length;

	// Queue all file checks
	const promises = files.map((fileToCheck) =>
		taskQueue.enqueue(async () => {
			const result = await checkFile(fileToCheck, options);
			results.push(result);
			completed++;
			await onProgress(result, completed, total);
			return result;
		}),
	);

	await Promise.all(promises);

	return results;
}
