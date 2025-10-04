export interface AutoRule {
	title: string;
	files: string;
	criteria: string;
	rulePath: string;
}
export interface FileToCheck {
	path: string;
	rule: AutoRule;
}
/**
 * Find all autorules folders in the project
 */
export declare function findAutoRulesFolders(
	rootDir: string,
): Promise<string[]>;
/**
 * Load all autorule files from a folder
 */
export declare function loadAutoRules(
	autorulesFolder: string,
): Promise<AutoRule[]>;
/**
 * Get all files that match a rule's glob pattern
 */
export declare function getFilesForRule(
	rule: AutoRule,
	baseDir: string,
): Promise<FileToCheck[]>;
/**
 * Scan the project and return all file/rule combinations to check
 */
export declare function scanProject(rootDir: string): Promise<{
	files: FileToCheck[];
	rules: AutoRule[];
}>;
//# sourceMappingURL=scanner.d.ts.map
