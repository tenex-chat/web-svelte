import { browser } from '$app/environment';
import { writable } from 'svelte/store';
import { storage } from './storage.svelte';

export interface ProjectGroup {
	id: string;
	name: string;
	projectIds: string[];
	createdAt: number;
	pinned?: boolean;
}

/**
 * Get all project groups from storage
 */
export function getProjectGroups(): ProjectGroup[] {
	if (!browser) return [];
	return storage.get('tenex:projectGroups') ?? [];
}

/**
 * Persist project groups to storage
 */
function persistProjectGroups(groups: ProjectGroup[]): void {
	if (!browser) return;
	storage.set('tenex:projectGroups', groups);
}

/**
 * Reactive store for project groups
 */
function createProjectGroupsStore() {
	const { subscribe, set, update } = writable<ProjectGroup[]>(
		browser ? getProjectGroups() : []
	);

	// Internal helper to update and persist in one place
	const updateAndPersist = (updater: (groups: ProjectGroup[]) => ProjectGroup[]) => {
		update((groups) => {
			const updated = updater(groups);
			persistProjectGroups(updated);
			return updated;
		});
	};

	return {
		subscribe,
		add: (name: string, projectIds: string[]) => {
			const newGroup: ProjectGroup = {
				id: generateId(),
				name,
				projectIds,
				createdAt: Date.now()
			};
			updateAndPersist((groups) => [...groups, newGroup]);
			return newGroup;
		},
		update: (groupId: string, changes: Partial<Pick<ProjectGroup, 'name' | 'projectIds'>>) => {
			let result: ProjectGroup | null = null;
			updateAndPersist((groups) => {
				const index = groups.findIndex((g) => g.id === groupId);
				if (index === -1) return groups;

				const updated = [...groups];
				updated[index] = { ...updated[index], ...changes };
				result = updated[index];
				return updated;
			});
			return result;
		},
		delete: (groupId: string) => {
			let deleted = false;
			updateAndPersist((groups) => {
				const filtered = groups.filter((g) => g.id !== groupId);
				if (filtered.length !== groups.length) {
					deleted = true;
					// Clear selection if deleted group was selected
					if (browser && getSelectedProjectGroup() === groupId) {
						setSelectedProjectGroup(null);
					}
				}
				return filtered;
			});
			return deleted;
		},
		togglePin: (groupId: string) => {
			let toggled = false;
			updateAndPersist((groups) => {
				const updated = groups.map((g) => {
					if (g.id === groupId) {
						toggled = true;
						return { ...g, pinned: !g.pinned };
					}
					return g;
				});
				return toggled ? updated : groups;
			});
			return toggled;
		},
		refresh: () => {
			set(browser ? getProjectGroups() : []);
		}
	};
}

export const projectGroupsStore = createProjectGroupsStore();

/**
 * Save a new project group (backwards compatibility wrapper)
 */
export function saveProjectGroup(name: string, projectIds: string[]): ProjectGroup {
	return projectGroupsStore.add(name, projectIds);
}

/**
 * Update an existing project group (backwards compatibility wrapper)
 */
export function updateProjectGroup(
	groupId: string,
	updates: Partial<Pick<ProjectGroup, 'name' | 'projectIds'>>
): ProjectGroup | null {
	return projectGroupsStore.update(groupId, updates);
}

/**
 * Delete a project group (backwards compatibility wrapper)
 */
export function deleteProjectGroup(groupId: string): boolean {
	return projectGroupsStore.delete(groupId);
}

/**
 * Toggle the pinned status of a project group (backwards compatibility wrapper)
 */
export function toggleGroupPin(groupId: string): boolean {
	return projectGroupsStore.togglePin(groupId);
}

/**
 * Get the currently selected project group ID
 */
export function getSelectedProjectGroup(): string | null {
	if (!browser) return null;
	return storage.get('tenex:selectedProjectGroup') ?? null;
}

/**
 * Set the currently selected project group ID
 */
export function setSelectedProjectGroup(groupId: string | null): void {
	if (!browser) return;

	if (groupId === null) {
		storage.remove('tenex:selectedProjectGroup');
	} else {
		storage.set('tenex:selectedProjectGroup', groupId);
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
