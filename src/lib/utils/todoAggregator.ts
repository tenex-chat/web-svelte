import type { NDKEvent } from '@nostr-dev-kit/ndk';
import { parseToolArgs } from './toolPaths';

export interface TodoItem {
	id: string;
	title: string;
	description?: string;
	status: 'pending' | 'in_progress' | 'done' | 'completed';
}

export interface AggregatedTodoState {
	items: TodoItem[];
	hasTodos: boolean;
}

/**
 * Extract the tool name from an event
 */
function getToolName(event: NDKEvent): string | undefined {
	const toolTag = event.tags?.find((tag) => tag[0] === 'tool');
	return toolTag?.[1];
}

/**
 * Get the title/content from a todo item - handles both field naming conventions
 * - Claude Code's TodoWrite uses: { content, status, activeForm }
 * - Some tools use: { title, description, status }
 */
function getTodoTitle(item: Record<string, unknown>): string | undefined {
	return (item.title as string) || (item.content as string) || undefined;
}

/**
 * Aggregate todo state from a list of events
 * Processes TodoWrite, todo_add, and todo_update calls to build current state
 */
export function aggregateTodoState(events: NDKEvent[]): AggregatedTodoState {
	const todosById = new Map<string, TodoItem>();
	let idCounter = 0;

	for (const event of events) {
		const toolName = getToolName(event);
		if (!toolName) continue;

		const args = parseToolArgs(event);
		if (!args) continue;

		// Handle TodoWrite tool (Claude Code's format) - uses 'todos' array with 'content' field
		if (toolName === 'TodoWrite' && Array.isArray(args.todos)) {
			// TodoWrite replaces the entire list, so clear and rebuild
			todosById.clear();
			idCounter = 0;

			for (const item of args.todos) {
				const title = getTodoTitle(item as Record<string, unknown>);
				if (title) {
					const id = `todo-${idCounter++}`;
					const status = (item as Record<string, unknown>).status as string;
					todosById.set(id, {
						id,
						title,
						description: (item as Record<string, unknown>).activeForm as string | undefined,
						status: (status === 'completed' ? 'done' : status as TodoItem['status']) || 'pending'
					});
				}
			}
			continue;
		}

		// Handle todo_add and todo_update (alternative format) - uses 'items' array
		if (!args.items || !Array.isArray(args.items)) continue;

		if (toolName === 'todo_add') {
			// Add new todos
			for (const item of args.items) {
				const title = getTodoTitle(item as Record<string, unknown>);
				if (title) {
					const id = (item as Record<string, unknown>).id as string || `todo-${idCounter++}`;
					todosById.set(id, {
						id,
						title,
						description: (item as Record<string, unknown>).description as string | undefined,
						status: ((item as Record<string, unknown>).status as TodoItem['status']) || 'pending'
					});
				}
			}
		} else if (toolName === 'todo_update') {
			// Update existing todos
			for (const item of args.items) {
				const itemObj = item as Record<string, unknown>;
				const itemId = itemObj.id as string;
				if (itemId && todosById.has(itemId)) {
					const existing = todosById.get(itemId)!;
					const newTitle = getTodoTitle(itemObj);
					const updated: TodoItem = { ...existing };
					if (newTitle) updated.title = newTitle;
					if (itemObj.description) updated.description = itemObj.description as string;
					if (itemObj.status) updated.status = itemObj.status as TodoItem['status'];
					todosById.set(itemId, updated);
				} else if (itemId) {
					// Create if doesn't exist (handles case where we didn't see the add)
					todosById.set(itemId, {
						id: itemId,
						title: getTodoTitle(itemObj) || itemId,
						description: itemObj.description as string | undefined,
						status: (itemObj.status as TodoItem['status']) || 'pending'
					});
				}
			}
		}
	}

	const items = Array.from(todosById.values());
	return {
		items,
		hasTodos: items.length > 0
	};
}
