import { browser } from '$app/environment';
import type { NDKProject } from '$lib/events/NDKProject';

const STORAGE_KEY = 'tenex:openProjects';

function loadFromStorage(): string[] {
	if (!browser) return [];
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		return stored ? JSON.parse(stored) : [];
	} catch {
		return [];
	}
}

function saveToStorage(ids: string[]) {
	if (!browser) return;
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
	} catch (error) {
		console.error('Failed to save open projects:', error);
	}
}

export const openProjects = (() => {
	let projectIds = $state<string[]>(loadFromStorage());
	let projects = $state<NDKProject[]>([]);

	return {
		get ids() {
			return projectIds;
		},
		get projects() {
			return projects;
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
