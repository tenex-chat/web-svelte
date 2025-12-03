import { browser } from '$app/environment';
import type { NDKProject } from '$lib/events/NDKProject';
import { selectedProjectGroupStore, getProjectGroups } from '$lib/utils/projectGroups';
import { storage } from '$lib/utils/storage.svelte';

function loadFromStorage(): string[] {
	if (!browser) return [];
	return storage.get('tenex:openProjects') ?? [];
}

function saveToStorage(ids: string[]) {
	if (!browser) return;
	storage.set('tenex:openProjects', ids);
}

export const openProjects = (() => {
	let projectIds = $state<string[]>(loadFromStorage());
	let projects = $state<NDKProject[]>([]);
	let selectedGroupId = $state<string | null>(null);

	// Subscribe to the store
	selectedProjectGroupStore.subscribe((value) => {
		selectedGroupId = value;
	});

	return {
		get ids() {
			return projectIds;
		},
		get projects() {
			return projects;
		},
		get filteredProjects() {
			// If no group is selected, show all open projects
			if (!selectedGroupId) {
				return projects;
			}

			// Find the selected group
			const groups = getProjectGroups();
			const selectedGroup = groups.find((g) => g.id === selectedGroupId);

			if (!selectedGroup) {
				return projects;
			}

			// Filter open projects to only those in the selected group
			return projects.filter((project) => {
				const projectId = project.dTag || project.id || '';
				return selectedGroup.projectIds.includes(projectId);
			});
		},
		toggle(project: NDKProject) {
			const projectId = project.dTag || project.encode();
			const isOpen = projectIds.includes(projectId);

			if (isOpen) {
				projectIds = projectIds.filter((id) => id !== projectId);
				projects = projects.filter((p) => (p.dTag || p.encode()) !== projectId);
			} else {
				projectIds = [...projectIds, projectId];
				projects = [...projects, project];
			}

			saveToStorage(projectIds);
		},
		isOpen(project: NDKProject): boolean {
			const projectId = project.dTag || project.encode();
			return projectIds.includes(projectId);
		},
		openSingle(project: NDKProject) {
			const projectId = project.dTag || project.encode();
			projectIds = [projectId];
			projects = [project];
			saveToStorage(projectIds);
		},
		closeAll() {
			projectIds = [];
			projects = [];
			saveToStorage([]);
		},
		// Update the full projects array when projects are loaded from store
		updateProjects(allProjects: NDKProject[]) {
			// Map stored IDs to actual project instances
			const resolvedProjects: NDKProject[] = [];
			for (const id of projectIds) {
				const project = allProjects.find((p) => p.dTag === id || p.encode() === id);
				if (project) {
					resolvedProjects.push(project);
				}
			}
			projects = resolvedProjects;
		}
	};
})();
