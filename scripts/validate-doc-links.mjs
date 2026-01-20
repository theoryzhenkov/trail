/**
 * Validates @see tags in source files point to existing documentation.
 * 
 * Checks:
 * 1. The referenced file exists
 * 2. If an anchor is specified, the heading exists in the markdown file
 */

import process from 'node:process';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const SEE_TAG_REGEX = /@see\s+(docs\/[^\s*]+)/g;

/**
 * Recursively find all .ts files in a directory
 */
function findTsFiles(dir, files = []) {
	const entries = readdirSync(dir);
	for (const entry of entries) {
		const fullPath = join(dir, entry);
		const stat = statSync(fullPath);
		if (stat.isDirectory()) {
			findTsFiles(fullPath, files);
		} else if (entry.endsWith('.ts')) {
			files.push(fullPath);
		}
	}
	return files;
}

/**
 * Extract @see tags from file content
 */
function extractSeeTags(content, filePath) {
	const tags = [];
	const lines = content.split('\n');
	
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		let match;
		SEE_TAG_REGEX.lastIndex = 0;
		
		while ((match = SEE_TAG_REGEX.exec(line)) !== null) {
			tags.push({
				path: match[1],
				line: i + 1,
				file: filePath,
			});
		}
	}
	
	return tags;
}

/**
 * Extract markdown headings from content
 */
function extractHeadings(content) {
	const headings = new Set();
	const lines = content.split('\n');
	
	for (const line of lines) {
		const match = line.match(/^#{1,6}\s+(.+)$/);
		if (match) {
			// Convert heading text to anchor format (lowercase, spaces to hyphens)
			const anchor = match[1]
				.toLowerCase()
				.replace(/[^\w\s-]/g, '')
				.replace(/\s+/g, '-')
				.replace(/-+/g, '-');
			headings.add(anchor);
		}
	}
	
	return headings;
}

/**
 * Validate a single @see tag
 */
function validateSeeTag(tag, rootDir) {
	const [filePath, anchor] = tag.path.split('#');
	const fullPath = join(rootDir, filePath);
	
	// Check if file exists
	if (!existsSync(fullPath)) {
		return {
			valid: false,
			error: `File not found: ${filePath}`,
		};
	}
	
	// If no anchor, we're done
	if (!anchor) {
		return { valid: true };
	}
	
	// Check if anchor exists in the markdown file
	const content = readFileSync(fullPath, 'utf-8');
	const headings = extractHeadings(content);
	
	if (!headings.has(anchor)) {
		return {
			valid: false,
			error: `Anchor not found: #${anchor} in ${filePath}`,
		};
	}
	
	return { valid: true };
}

function main() {
	const rootDir = process.cwd();
	const srcDir = join(rootDir, 'src');
	
	if (!existsSync(srcDir)) {
		console.error('Error: src/ directory not found');
		process.exit(1);
	}
	
	console.log('Validating @see documentation links...\n');
	
	const tsFiles = findTsFiles(srcDir);
	const allTags = [];
	
	// Extract all @see tags
	for (const file of tsFiles) {
		const content = readFileSync(file, 'utf-8');
		const tags = extractSeeTags(content, file);
		allTags.push(...tags);
	}
	
	if (allTags.length === 0) {
		console.log('No @see tags found in source files.');
		process.exit(0);
	}
	
	console.log(`Found ${allTags.length} @see tag(s) in ${tsFiles.length} file(s).\n`);
	
	// Validate each tag
	const errors = [];
	
	for (const tag of allTags) {
		const result = validateSeeTag(tag, rootDir);
		if (!result.valid) {
			errors.push({
				...tag,
				error: result.error,
			});
		}
	}
	
	// Report results
	if (errors.length === 0) {
		console.log('All @see links are valid.');
		process.exit(0);
	}
	
	console.error(`Found ${errors.length} broken link(s):\n`);
	
	for (const error of errors) {
		const relPath = relative(rootDir, error.file);
		console.error(`  ${relPath}:${error.line}`);
		console.error(`    @see ${error.path}`);
		console.error(`    ${error.error}\n`);
	}
	
	process.exit(1);
}

main();
