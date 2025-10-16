<script lang="ts">
	import type { NDKProject } from '$lib/events/NDKProject';
	import type { ProjectAgent } from '$lib/events/NDKProjectStatus';
	import GeneralSettings from './GeneralSettings.svelte';
	import AgentsSettings from './AgentsSettings.svelte';
	import ToolsSettings from './ToolsSettings.svelte';

	interface Props {
		project: NDKProject;
		onlineAgents?: ProjectAgent[];
	}

	let { project, onlineAgents = [] }: Props = $props();

	type SettingsSection = 'general' | 'agents' | 'tools' | 'advanced' | 'danger';

	let activeSection = $state<SettingsSection>('general');

	const sections = [
		{
			id: 'general' as const,
			title: 'General',
			description: 'Project name, description, and basic info',
			icon: '⚙️'
		},
		{
			id: 'agents' as const,
			title: 'Agents',
			description: 'Manage AI agents for this project',
			icon: '🤖'
		},
		{
			id: 'tools' as const,
			title: 'Tools',
			description: 'MCP tools configuration',
			icon: '🔧'
		},
		{
			id: 'advanced' as const,
			title: 'Advanced',
			description: 'Relays and advanced settings',
			icon: '🔬'
		},
		{
			id: 'danger' as const,
			title: 'Danger Zone',
			description: 'Delete or archive this project',
			icon: '⚠️'
		}
	];
</script>

<div class="h-full flex">
	<!-- Settings Navigation -->
	<div class="w-48 border-r border-border bg-white p-2 space-y-1">
		{#each sections as section (section.id)}
			<button
				onclick={() => (activeSection = section.id)}
				class="w-full text-left px-3 py-2 rounded transition-colors {activeSection === section.id
					? 'bg-blue-50 text-blue-900'
					: 'hover:bg-muted text-foreground'}"
			>
				<div class="flex items-start gap-2">
					<span class="text-lg leading-none">{section.icon}</span>
					<div class="flex-1 min-w-0">
						<div class="text-sm font-medium truncate">{section.title}</div>
						<div class="text-xs text-muted-foreground truncate">{section.description}</div>
					</div>
				</div>
			</button>
		{/each}
	</div>

	<!-- Settings Content -->
	<div class="flex-1 overflow-y-auto bg-muted">
		{#if activeSection === 'general'}
			<GeneralSettings {project} />
		{:else if activeSection === 'agents'}
			<AgentsSettings {project} {onlineAgents} />
		{:else if activeSection === 'tools'}
			<ToolsSettings {project} />
		{:else if activeSection === 'advanced'}
			<div class="p-4">
				<h2 class="text-lg font-semibold mb-4">Advanced Settings</h2>
				<p class="text-sm text-muted-foreground">Coming soon...</p>
			</div>
		{:else if activeSection === 'danger'}
			<div class="p-4">
				<h2 class="text-lg font-semibold mb-4 text-red-600">Danger Zone</h2>
				<div class="border border-red-200 rounded-lg p-4 bg-red-50">
					<h3 class="text-sm font-medium text-red-900 mb-2">Delete Project</h3>
					<p class="text-sm text-red-700 mb-3">
						Once you delete a project, there is no going back. This action publishes a deletion
						event to Nostr.
					</p>
					<button
						class="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition-colors text-sm font-medium"
					>
						Delete Project
					</button>
				</div>
			</div>
		{/if}
	</div>
</div>
