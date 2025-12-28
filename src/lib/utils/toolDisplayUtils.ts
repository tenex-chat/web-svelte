import type { NDKEvent } from '@nostr-dev-kit/ndk';
import { getToolName, parseToolArgs, getDisplayPathFromEvent } from './toolPaths';

/**
 * Tool categories for grouping and display purposes
 */
export type ToolCategory = 'read' | 'write' | 'execute' | 'delegate' | 'search' | 'other';

/**
 * Verb configuration for each category
 */
interface VerbConfig {
	activeVerb: string; // "Reading", "Writing"
	pastVerb: string; // "Read", "Wrote"
	noun: string; // "file", "command"
	pluralNoun: string; // "files", "commands"
}

/**
 * Information extracted from a tool event for display purposes
 */
export interface ToolActionInfo {
	category: ToolCategory;
	toolName: string;
	detail: string | null; // file path, command, agent name, etc.
}

/**
 * Map tool names to their categories
 */
const TOOL_CATEGORIES: Record<string, ToolCategory> = {
	// Read operations
	Read: 'read',
	read_path: 'read',
	read_file: 'read',
	ReadFile: 'read',
	cat: 'read',

	// Write operations
	Write: 'write',
	write_file: 'write',
	WriteFile: 'write',
	Edit: 'write',
	EditFile: 'write',
	edit_file: 'write',
	NotebookEdit: 'write',
	create_file: 'write',
	CreateFile: 'write',

	// Search operations
	Glob: 'search',
	Grep: 'search',
	codebase_search: 'search',
	search_files: 'search',
	find_files: 'search',
	Search: 'search',

	// Execute operations
	Bash: 'execute',
	shell: 'execute',
	run_command: 'execute',
	execute_command: 'execute',
	Terminal: 'execute',

	// Delegate operations
	delegate: 'delegate',
	delegate_external: 'delegate',
	Task: 'delegate',
	spawn_agent: 'delegate'
};

/**
 * Verb configurations for each category
 */
const CATEGORY_VERBS: Record<ToolCategory, VerbConfig> = {
	read: { activeVerb: 'Reading', pastVerb: 'Read', noun: 'file', pluralNoun: 'files' },
	write: { activeVerb: 'Writing', pastVerb: 'Wrote', noun: 'file', pluralNoun: 'files' },
	execute: { activeVerb: 'Executing', pastVerb: 'Executed', noun: 'command', pluralNoun: 'commands' },
	delegate: { activeVerb: 'Delegating to', pastVerb: 'Delegated to', noun: 'agent', pluralNoun: 'agents' },
	search: { activeVerb: 'Searching for', pastVerb: 'Searched for', noun: 'query', pluralNoun: 'queries' },
	other: { activeVerb: 'Using', pastVerb: 'Used', noun: 'tool', pluralNoun: 'tools' }
};

/**
 * Get the category for a tool name
 */
export function getToolCategory(toolName: string | null): ToolCategory {
	if (!toolName) return 'other';
	return TOOL_CATEGORIES[toolName] || 'other';
}

/**
 * Extract the relevant detail from a tool event based on its category
 */
function extractToolDetail(event: NDKEvent, toolName: string, category: ToolCategory): string | null {
	const args = parseToolArgs(event);

	switch (category) {
		case 'read':
		case 'write': {
			const filePath =
				(args?.file_path as string) ||
				(args?.path as string) ||
				(args?.filepath as string) ||
				(args?.filename as string) ||
				(args?.file as string) ||
				(args?.target as string) ||
				(args?.notebook_path as string);
			if (filePath) {
				return getDisplayPathFromEvent(event, filePath);
			}
			return null;
		}

		case 'execute': {
			const command = args?.command as string;
			if (command) {
				// Truncate long commands
				return command.length > 50 ? command.substring(0, 47) + '...' : command;
			}
			return null;
		}

		case 'delegate': {
			// For delegate tools, try to get the agent name from various structures
			const delegations = args?.delegations as Array<{ recipient?: string }> | undefined;
			const firstRecipient = delegations?.[0]?.recipient;
			const agentName =
				firstRecipient ||
				(args?.agent as string) ||
				(args?.subagent_type as string) ||
				(args?.recipient as string) ||
				(args?.description as string);
			if (agentName) {
				return agentName.length > 30 ? agentName.substring(0, 27) + '...' : agentName;
			}
			return null;
		}

		case 'search': {
			const query = (args?.query as string) || (args?.pattern as string);
			if (query) {
				const truncated = query.length > 30 ? query.substring(0, 27) + '...' : query;
				const searchType = args?.searchType as string;
				if (searchType === 'filename') {
					return `files matching "${truncated}"`;
				}
				return `"${truncated}"`;
			}
			return null;
		}

		default:
			return null;
	}
}

/**
 * Get action info for a single tool event
 */
export function getToolActionInfo(event: NDKEvent): ToolActionInfo {
	const toolName = getToolName(event) || 'unknown';
	const category = getToolCategory(toolName);
	const detail = extractToolDetail(event, toolName, category);

	return { category, toolName, detail };
}

/**
 * Options for generating tool group display text
 */
export interface ToolGroupDisplayOptions {
	tools: Array<{ event: NDKEvent }>;
	isActive: boolean;
}

/**
 * Determine the dominant category for a set of tools
 * Returns 'other' if tools are mixed categories
 */
function getDominantCategory(actions: ToolActionInfo[]): ToolCategory {
	if (actions.length === 0) return 'other';

	const firstCategory = actions[0].category;
	const allSame = actions.every((a) => a.category === firstCategory);

	return allSame ? firstCategory : 'other';
}

/**
 * Generate display text for a tool group
 */
export function getToolGroupDisplayText(options: ToolGroupDisplayOptions): string {
	const { tools, isActive } = options;

	if (tools.length === 0) {
		return '';
	}

	const actions = tools.map((t) => getToolActionInfo(t.event));
	const dominantCategory = getDominantCategory(actions);
	const verbs = CATEGORY_VERBS[dominantCategory];

	if (isActive) {
		// Active state
		if (tools.length === 1) {
			// Single tool: show detail
			const action = actions[0];
			const actionVerbs = CATEGORY_VERBS[action.category];

			if (action.detail) {
				return `${actionVerbs.activeVerb} ${action.detail}`;
			}
			// For single tools without detail, show the tool name instead of "1 tool"
			return `${actionVerbs.activeVerb} ${action.toolName}`;
		} else {
			// Multiple tools: aggregate
			const noun = verbs.pluralNoun;
			return `${verbs.activeVerb} ${tools.length} ${noun}`;
		}
	} else {
		// Completed: show summary
		if (tools.length === 1) {
			const action = actions[0];
			const actionVerbs = CATEGORY_VERBS[action.category];

			if (action.detail) {
				return `${actionVerbs.pastVerb} ${action.detail}`;
			}
			// For single tools without detail, show the tool name instead of "1 tool"
			return `${actionVerbs.pastVerb} ${action.toolName}`;
		} else {
			// Multiple tools
			const noun = verbs.pluralNoun;
			return `${verbs.pastVerb} ${tools.length} ${noun}`;
		}
	}
}

/**
 * Generate display text for an individual tool (used when expanded)
 */
export function getIndividualToolDisplayText(event: NDKEvent): string {
	const action = getToolActionInfo(event);
	const verbs = CATEGORY_VERBS[action.category];

	if (action.detail) {
		if (action.category === 'delegate') {
			return `${verbs.pastVerb} ${action.detail}`;
		}
		return `${verbs.pastVerb} ${action.detail}`;
	}

	return `${verbs.pastVerb} ${action.toolName}`;
}

/**
 * Get the appropriate icon name for a tool category
 */
export function getToolCategoryIcon(category: ToolCategory): string {
	switch (category) {
		case 'read':
			return 'file-text';
		case 'write':
			return 'pencil';
		case 'execute':
			return 'terminal';
		case 'delegate':
			return 'users';
		case 'search':
			return 'search';
		default:
			return 'settings';
	}
}

/**
 * Get the dominant icon for a tool group
 */
export function getToolGroupIcon(tools: Array<{ event: NDKEvent }>): string {
	if (tools.length === 0) return 'settings';

	const actions = tools.map((t) => getToolActionInfo(t.event));
	const dominantCategory = getDominantCategory(actions);

	return getToolCategoryIcon(dominantCategory);
}
