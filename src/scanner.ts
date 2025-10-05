import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { glob } from "glob";

export interface AutoRule {
	title: string;
	files: string;
	includes?: string;
	criteria: string;
	rulePath: string;
}

export interface FileToCheck {
	path: string;
	rule: AutoRule;
}

/**
 * Parse frontmatter from a markdown file
 */
function parseFrontmatter(content: string): {
	metadata: Record<string, string>;
	body: string;
} {
	const frontmatterRegex = /^([\s\S]*?)---\n([\s\S]+)$/;
	const match = content.match(frontmatterRegex);

	if (!match) {
		throw new Error(
			"Invalid autorule format. Expected frontmatter with title and files.",
		);
	}

	const [, frontmatter, body] = match;
	const metadata: Record<string, string> = {};

	frontmatter
		.trim()
		.split("\n")
		.forEach((line) => {
			const colonIndex = line.indexOf(":");
			if (colonIndex > 0) {
				const key = line.substring(0, colonIndex).trim();
				const value = line.substring(colonIndex + 1).trim();
				metadata[key] = value;
			}
		});

	return { metadata, body: body.trim() };
}

/**
 * Find all autorules folders in the project
 */
export async function findAutoRulesFolders(rootDir: string): Promise<string[]> {
	const folders: string[] = [];

	async function scan(dir: string) {
		const entries = await readdir(dir, { withFileTypes: true });

		for (const entry of entries) {
			const fullPath = join(dir, entry.name);

			if (entry.isDirectory()) {
				if (entry.name === "autorules") {
					folders.push(fullPath);
				} else if (
					entry.name !== "node_modules" &&
					!entry.name.startsWith(".")
				) {
					await scan(fullPath);
				}
			}
		}
	}

	await scan(rootDir);
	return folders;
}

/**
 * Load all autorule files from a folder
 */
export async function loadAutoRules(
	autorulesFolder: string,
): Promise<AutoRule[]> {
	const entries = await readdir(autorulesFolder, { withFileTypes: true });
	const rules: AutoRule[] = [];

	for (const entry of entries) {
		if (entry.isFile() && entry.name.endsWith(".md")) {
			const rulePath = join(autorulesFolder, entry.name);
			const content = await readFile(rulePath, "utf-8");
			const { metadata, body } = parseFrontmatter(content);

			rules.push({
				title: metadata.title || "Untitled Rule",
				files: metadata.files || "**/*",
				includes: metadata.includes,
				criteria: body,
				rulePath,
			});
		}
	}

	return rules;
}

/**
 * Get all files that match a rule's glob pattern
 */
export async function getFilesForRule(
	rule: AutoRule,
	baseDir: string,
): Promise<FileToCheck[]> {
	const pattern = rule.files;
	const files = await glob(pattern, {
		cwd: baseDir,
		nodir: true,
		ignore: ["**/node_modules/**", "**/autorules/**"],
	});

	return files.map((file) => ({
		path: join(baseDir, file),
		rule,
	}));
}

/**
 * Scan the project and return all file/rule combinations to check
 */
export async function scanProject(
	rootDir: string,
): Promise<{ files: FileToCheck[]; rules: AutoRule[] }> {
	const autoRulesFolders = await findAutoRulesFolders(rootDir);
	const allRules: AutoRule[] = [];
	const allFiles: FileToCheck[] = [];

	for (const folder of autoRulesFolders) {
		const rules = await loadAutoRules(folder);
		allRules.push(...rules);

		// Get the base directory for file matching (parent of autorules folder)
		const baseDir = join(folder, "..");

		for (const rule of rules) {
			const files = await getFilesForRule(rule, baseDir);
			allFiles.push(...files);
		}
	}

	return { files: allFiles, rules: allRules };
}
