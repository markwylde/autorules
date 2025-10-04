import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { glob } from "glob";

/**
 * Parse frontmatter from a markdown file
 */
function parseFrontmatter(content) {
	const frontmatterRegex = /^(title: .+\nfiles: .+\n)---\n([\s\S]+)$/;
	const match = content.match(frontmatterRegex);
	if (!match) {
		throw new Error(
			"Invalid autorule format. Expected frontmatter with title and files.",
		);
	}
	const [, frontmatter, body] = match;
	const metadata = {};
	frontmatter
		.trim()
		.split("\n")
		.forEach((line) => {
			const [key, ...valueParts] = line.split(":");
			metadata[key.trim()] = valueParts.join(":").trim();
		});
	return { metadata, body: body.trim() };
}
/**
 * Find all autorules folders in the project
 */
export async function findAutoRulesFolders(rootDir) {
	const folders = [];
	async function scan(dir) {
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
export async function loadAutoRules(autorulesFolder) {
	const entries = await readdir(autorulesFolder, { withFileTypes: true });
	const rules = [];
	for (const entry of entries) {
		if (entry.isFile() && entry.name.endsWith(".md")) {
			const rulePath = join(autorulesFolder, entry.name);
			const content = await readFile(rulePath, "utf-8");
			const { metadata, body } = parseFrontmatter(content);
			rules.push({
				title: metadata.title || "Untitled Rule",
				files: metadata.files || "**/*",
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
export async function getFilesForRule(rule, baseDir) {
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
export async function scanProject(rootDir) {
	const autoRulesFolders = await findAutoRulesFolders(rootDir);
	const allRules = [];
	const allFiles = [];
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
//# sourceMappingURL=scanner.js.map
