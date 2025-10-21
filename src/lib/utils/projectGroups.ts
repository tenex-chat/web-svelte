import { browser } from '$app/environment';
import { writable } from 'svelte/store';

const STORAGE_KEY = 'tenex:projectGroups';
const SELECTED_GROUP_KEY = 'tenex:selectedProjectGroup';

export interface ProjectGroup {
	id: string;
	name: string;
	projectIds: string[];
	createdAt: number;
}

/**
 * Get all project groups from localStorage
 */
export function getProjectGroups(): ProjectGroup[] {
	if (!browser) return [];

	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (!stored) return [];

		return JSON.parse(stored);
	} catch (error) {
		console.error('Failed to parse project groups from localStorage:', error);
		return [];
	}
}

/**
 * Save a new project group
 */
export function saveProjectGroup(name: string, projectIds: string[]): ProjectGroup {
	const groups = getProjectGroups();

	const newGroup: ProjectGroup = {
		id: generateId(),
		name,
		projectIds,
		createdAt: Date.now()
	};

	groups.push(newGroup);

	if (browser) {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(groups));
	}

	return newGroup;
}

/**
 * Update an existing project group
 */
export function updateProjectGroup(
	groupId: string,
	updates: Partial<Pick<ProjectGroup, 'name' | 'projectIds'>>
): ProjectGroup | null {
	const groups = getProjectGroups();
	const groupIndex = groups.findIndex((g) => g.id === groupId);

	if (groupIndex === -1) return null;

	const updatedGroup = {
		...groups[groupIndex],
		...updates
	};

	groups[groupIndex] = updatedGroup;

	if (browser) {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(groups));
	}

	return updatedGroup;
}

/**
 * Delete a project group
 */
export function deleteProjectGroup(groupId: string): boolean {
	const groups = getProjectGroups();
	const filteredGroups = groups.filter((g) => g.id !== groupId);

	if (filteredGroups.length === groups.length) {
		return false; // Group not found
	}

	if (browser) {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(filteredGroups));

		// If the deleted group was selected, clear the selection
		if (getSelectedProjectGroup() === groupId) {
			setSelectedProjectGroup(null);
		}
	}

	return true;
}

/**
 * Get the currently selected project group ID
 */
export function getSelectedProjectGroup(): string | null {
	if (!browser) return null;

	return localStorage.getItem(SELECTED_GROUP_KEY);
}

/**
 * Set the currently selected project group ID
 */
export function setSelectedProjectGroup(groupId: string | null): void {
	if (!browser) return;

	if (groupId === null) {
		localStorage.removeItem(SELECTED_GROUP_KEY);
	} else {
		localStorage.setItem(SELECTED_GROUP_KEY, groupId);
	}
}

/**
 * Generate a unique ID for a project group
 */
function generateId(): string {
	return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Reactive store for the selected project group
 */
function createSelectedProjectGroupStore() {
	const { subscribe, set } = writable<string | null>(browser ? getSelectedProjectGroup() : null);

	return {
		subscribe,
		set: (groupId: string | null) => {
			set(groupId);
			setSelectedProjectGroup(groupId);
		}
	};
}

export const selectedProjectGroupStore = createSelectedProjectGroupStore();
