import type { NDKEvent } from '@nostr-dev-kit/ndk';

/**
 * Extracts the project d-tag from an event's "a" tag.
 * The "a" tag format is: "31933:pubkey:d-tag"
 */
export function extractProjectDTag(event: NDKEvent): string | null {
	const aTag = event.tags.find((tag) => tag[0] === 'a');
	if (!aTag || !aTag[1]) return null;

	const parts = aTag[1].split(':');
	// Format: kind:pubkey:d-tag
	if (parts.length >= 3) {
		return parts.slice(2).join(':'); // Handle d-tags that might contain colons
	}
	return null;
}

/**
 * Extracts the branch name from an event's "branch" tag.
 */
export function extractBranch(event: NDKEvent): string | null {
	return event.tagValue('branch') || null;
}

/**
 * Parses the tool-args tag value as JSON.
 * Returns null if no tool-args tag or if parsing fails.
 */
export function parseToolArgs(event: NDKEvent): Record<string, unknown> | null {
	const toolArgsTag = event.tags.find((tag) => tag[0] === 'tool-args');
	if (!toolArgsTag || !toolArgsTag[1]) return null;

	try {
		return JSON.parse(toolArgsTag[1]);
	} catch {
		return null;
	}
}

/**
 * Gets the tool name from an event's "tool" tag.
 */
export function getToolName(event: NDKEvent): string | null {
	return event.tagValue('tool') || null;
}

/**
 * Converts a full file path to a display-friendly relative path.
 *
 * Given:
 * - fullPath: /Users/user/10x/TENEX-Web-Svelte-ow3jsn/responsive-implementation/src/file.ts
 * - projectDTag: TENEX-Web-Svelte-ow3jsn
 * - branch: responsive-implementation
 *
 * Returns: src/file.ts
 *
 * If projectDTag or branch aren't found in the path, returns the basename.
 */
export function getDisplayPath(
	fullPath: string,
	projectDTag: string | null,
	branch: string | null
): string {
	if (!fullPath) return '';

	// If no project d-tag, just return the filename
	if (!projectDTag) {
		return getBasename(fullPath);
	}

	// Find the project d-tag in the path
	const dTagIndex = fullPath.indexOf(projectDTag);
	if (dTagIndex === -1) {
		return getBasename(fullPath);
	}

	// Get everything after the d-tag
	let relativePath = fullPath.substring(dTagIndex + projectDTag.length);

	// Remove leading slash
	if (relativePath.startsWith('/')) {
		relativePath = relativePath.substring(1);
	}

	// If branch exists and the path starts with it, strip it
	if (branch && relativePath.startsWith(branch + '/')) {
		relativePath = relativePath.substring(branch.length + 1);
	}

	return relativePath || getBasename(fullPath);
}

/**
 * Gets the filename from a path (everything after the last /).
 */
export function getBasename(path: string): string {
	if (!path) return '';
	const lastSlash = path.lastIndexOf('/');
	return lastSlash === -1 ? path : path.substring(lastSlash + 1);
}

/**
 * All-in-one helper to get display path from an event and a file path.
 */
export function getDisplayPathFromEvent(event: NDKEvent, fullPath: string): string {
	const projectDTag = extractProjectDTag(event);
	const branch = extractBranch(event);
	return getDisplayPath(fullPath, projectDTag, branch);
}
