<script lang="ts">
	import { ndk } from '$lib/ndk.svelte';
	import { projectStatusStore } from '$lib/stores/projectStatus.svelte';
	import { openProjects } from '$lib/stores/openProjects.svelte';
	import { NDKProjectStatus } from '$lib/events/NDKProjectStatus';
	import type { NDKEvent } from '@nostr-dev-kit/ndk';

	interface Props {
		open?: boolean;
	}

	let { open = true }: Props = $props();

	const currentUser = $derived(ndk.$sessions.currentUser);
	const projects = $derived(openProjects.projects);
	const projectStatusMap = $derived(projectStatusStore.allStatus);

	let selectedProjectDTag = $state<string | null>(null);
	let showProjectSidebar = $state(true);
	let activeTab = $state<'comparison' | 'store' | 'wire'>('comparison');
	let expandedAgents = $state<Set<string>>(new Set());

	// Independent wire feed subscription (last 60 seconds)
	const oneMinuteAgo = Math.floor(Date.now() / 1000) - 60;

	interface WireFeedEvent {
		id: string;
		projectId?: string;
		projectTitle?: string;
		timestamp: Date;
		isOnline: boolean;
		agents: any[];
		models: any[];
		rawEvent: NDKEvent;
	}

	let wireFeedEvents = $state<WireFeedEvent[]>([]);

	// Subscribe to wire feed
	$effect(() => {
		if (!currentUser?.pubkey) return;

		const subscription = ndk.$subscribe(
			() => ({
				filters: [
					{
						kinds: [24010],
						'#p': [currentUser.pubkey],
						since: oneMinuteAgo
					}
				],
				closeOnEose: false,
			}),
			{ subId: 'debug-wire-feed', bufferMs: 100 }
		);

		$effect(() => {
			const events = subscription.events as NDKProjectStatus[];

			const processed: WireFeedEvent[] = events.map((event) => {
				// Extract project title from "a" tag
				const aTag = event.tagValue('a');
				const projectTitle = aTag?.split(':')[2];

				return {
					id: event.id || `event-${Date.now()}`,
					projectId: event.projectId,
					projectTitle,
					timestamp: new Date((event.created_at || 0) * 1000),
					isOnline: event.isOnline,
					agents: event.agents || [],
					models: event.models || [],
					rawEvent: event
				};
			});

			// Sort by timestamp descending, keep last 100
			wireFeedEvents = processed
				.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
				.slice(0, 100);
		});
	});

	// Set first project as selected by default
	$effect(() => {
		if (projects.length > 0 && !selectedProjectDTag) {
			selectedProjectDTag = projects[0].dTag || null;
		}
	});

	const selectedProject = $derived(projects.find((p) => p.dTag === selectedProjectDTag));
	const selectedProjectStatus = $derived(
		selectedProjectDTag ? projectStatusMap.get(selectedProjectDTag) : null
	);

	// Filter wire feed events for selected project
	const selectedProjectWireEvents = $derived(
		wireFeedEvents.filter(
			(event) =>
				event.projectId === selectedProjectDTag || event.projectId === selectedProject?.tagId()
		)
	);

	function toggleAgentExpanded(agentKey: string) {
		const newSet = new Set(expandedAgents);
		if (newSet.has(agentKey)) {
			newSet.delete(agentKey);
		} else {
			newSet.add(agentKey);
		}
		expandedAgents = newSet;
	}

	function formatTimeAgo(timestamp: Date): string {
		const seconds = Math.floor((Date.now() - timestamp.getTime()) / 1000);
		if (seconds < 60) return `${seconds}s`;
		const minutes = Math.floor(seconds / 60);
		if (minutes < 60) return `${minutes}m`;
		const hours = Math.floor(minutes / 60);
		return `${hours}h`;
	}
</script>

{#if open}
	<div
		class="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4"
		onclick={(e) => {
			if (e.target === e.currentTarget) open = false;
		}}
		role="dialog"
		aria-modal="true"
	>
		<div
			class="bg-white rounded-lg shadow-2xl w-[95vw] h-[90vh] flex flex-col"
			onclick={(e) => e.stopPropagation()}
		>
			<!-- Header -->
			<div class="px-6 pt-6 pb-4 border-b flex items-center justify-between flex-shrink-0">
				<div class="flex items-center gap-2">
					<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14"
						/>
					</svg>
					<h2 class="text-lg font-semibold">Project Status Debug (24010 Events)</h2>
				</div>
				<button
					onclick={() => (showProjectSidebar = !showProjectSidebar)}
					class="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50 transition-colors flex items-center gap-2"
				>
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d={showProjectSidebar ? 'M11 19l-7-7 7-7m8 14l-7-7 7-7' : 'M13 5l7 7-7 7M5 5l7 7-7 7'}
						/>
					</svg>
					{showProjectSidebar ? 'Hide' : 'Show'} Projects
				</button>
			</div>

			<!-- Tab Navigation -->
			<div class="mx-6 mt-4 flex gap-2 border-b flex-shrink-0">
				<button
					onclick={() => (activeTab = 'comparison')}
					class="px-4 py-2 text-sm font-medium transition-colors border-b-2 {activeTab ===
					'comparison'
						? 'border-blue-600 text-blue-600'
						: 'border-transparent text-gray-600 hover:text-gray-900'}"
				>
					Side-by-Side Comparison
				</button>
				<button
					onclick={() => (activeTab = 'store')}
					class="px-4 py-2 text-sm font-medium transition-colors border-b-2 {activeTab === 'store'
						? 'border-blue-600 text-blue-600'
						: 'border-transparent text-gray-600 hover:text-gray-900'}"
				>
					Centralized Store Only
				</button>
				<button
					onclick={() => (activeTab = 'wire')}
					class="px-4 py-2 text-sm font-medium transition-colors border-b-2 {activeTab === 'wire'
						? 'border-blue-600 text-blue-600'
						: 'border-transparent text-gray-600 hover:text-gray-900'}"
				>
					Wire Feed Only
				</button>
			</div>

			<!-- Tab Content -->
			<div class="flex-1 overflow-hidden">
				{#if activeTab === 'comparison'}
					<!-- Side-by-Side Comparison -->
					<div class="h-full flex">
						<!-- Project Sidebar -->
						{#if showProjectSidebar}
							<div class="w-64 border-r flex flex-col flex-shrink-0">
								<div class="px-4 py-2 border-b bg-gray-50">
									<h3 class="text-sm font-medium">Projects</h3>
								</div>
								<div class="flex-1 overflow-y-auto p-2 space-y-1">
									{#each projects as project (project.dTag)}
										{@const status = projectStatusMap.get(project.dTag || '')}
										<button
											onclick={() => (selectedProjectDTag = project.dTag || null)}
											class="w-full text-left px-3 py-2 rounded text-sm transition-colors hover:bg-gray-100 {selectedProjectDTag ===
											project.dTag
												? 'bg-gray-100'
												: ''}"
										>
											<div class="flex items-center gap-2">
												<div
													class="w-2 h-2 rounded-full {status?.isOnline
														? 'bg-green-500'
														: 'bg-gray-300'}"
												></div>
												<span class="truncate">{project.title || project.dTag}</span>
											</div>
											{#if status}
												<div class="flex gap-1 mt-1">
													<span class="text-xs px-1 py-0.5 bg-gray-200 rounded"
														>{status.agents.length} agents</span
													>
													<span class="text-xs px-1 py-0.5 bg-gray-200 rounded"
														>{status.models.length} models</span
													>
												</div>
											{/if}
										</button>
									{/each}
								</div>
							</div>
						{/if}

						<!-- Comparison View -->
						<div class="flex-1 flex min-w-0">
							<!-- Centralized Store -->
							<div class="flex-1 border-r flex flex-col min-w-0">
								<div class="px-4 py-3 border-b bg-blue-50 flex-shrink-0">
									<h3 class="font-medium">Centralized Store</h3>
								</div>
								<div class="flex-1 overflow-y-auto p-4 space-y-4">
									{#if selectedProjectStatus}
										<div class="border border-gray-200 rounded p-4 space-y-3">
											<div>
												<h4 class="text-sm font-medium mb-2 flex items-center gap-2">
													Status
												</h4>
												<div class="space-y-1 text-sm">
													<div>
														Online: {selectedProjectStatus.isOnline ? 'Yes' : 'No'}
													</div>
													{#if selectedProjectStatus.lastSeen}
														<div>
															Last seen: {formatTimeAgo(selectedProjectStatus.lastSeen)} ago
														</div>
													{/if}
												</div>
											</div>

											<div>
												<h4 class="text-sm font-medium mb-2">
													Agents ({selectedProjectStatus.agents.length})
												</h4>
												<div class="space-y-2">
													{#each selectedProjectStatus.agents as agent, idx (`store-${agent.pubkey}-${idx}`)}
														{@const agentKey = `store-${agent.pubkey}-${idx}`}
														{@const isExpanded = expandedAgents.has(agentKey)}
														{@const hasTools = agent.tools && agent.tools.length > 0}
														<div class="border rounded text-sm">
															<div
																class="p-2 {hasTools
																	? 'cursor-pointer hover:bg-gray-50'
																	: ''}"
																onclick={() => hasTools && toggleAgentExpanded(agentKey)}
																role={hasTools ? 'button' : undefined}
																tabindex={hasTools ? 0 : undefined}
															>
																<div class="font-mono text-xs text-gray-500 mb-1">
																	{agent.pubkey.slice(0, 8)}...
																</div>
																<div class="flex items-center gap-2 flex-wrap">
																	<span class="font-medium">{agent.name}</span>
																	{#if agent.isGlobal}
																		<span class="text-xs px-1.5 py-0.5 bg-gray-200 rounded"
																			>Global</span
																		>
																	{/if}
																	{#if agent.model}
																		<span class="text-xs px-1.5 py-0.5 border rounded"
																			>{agent.model}</span
																		>
																	{/if}
																	{#if hasTools}
																		<span class="text-xs px-1.5 py-0.5 border rounded">
																			{isExpanded ? '▼' : '▶'} {agent.tools?.length || 0} tools
																		</span>
																	{/if}
																</div>
															</div>
															{#if hasTools && isExpanded}
																<div class="border-t p-2 bg-gray-50">
																	<div class="flex flex-wrap gap-1">
																		{#each agent.tools as tool}
																			<span class="text-xs px-1.5 py-0.5 bg-gray-200 rounded"
																				>{tool}</span
																			>
																		{/each}
																	</div>
																</div>
															{/if}
														</div>
													{/each}
												</div>
											</div>

											<div>
												<h4 class="text-sm font-medium mb-2">
													Models ({selectedProjectStatus.models.length})
												</h4>
												<div class="flex flex-wrap gap-1">
													{#each selectedProjectStatus.models as model}
														<span class="text-xs px-2 py-1 border rounded">{model.name}</span>
													{/each}
												</div>
											</div>
										</div>
									{:else}
										<div class="text-center text-gray-500 py-8">
											No status data in centralized store
										</div>
									{/if}
								</div>
							</div>

							<!-- Wire Feed -->
							<div class="flex-1 flex flex-col min-w-0">
								<div class="px-4 py-3 border-b bg-green-50 flex-shrink-0">
									<h3 class="font-medium">Wire Feed (Live)</h3>
								</div>
								<div class="flex-1 overflow-y-auto p-4 space-y-4">
									{#if selectedProjectWireEvents.length > 0}
										{#each selectedProjectWireEvents as event (event.id)}
											<div class="border border-gray-200 rounded p-4">
												<div class="flex items-center justify-between mb-2">
													<span class="text-sm font-medium">
														{formatTimeAgo(event.timestamp)} ago
													</span>
													<span class="text-xs font-mono text-gray-500">
														{event.id.slice(0, 8)}...
													</span>
												</div>

												<div class="space-y-2 text-sm">
													<div>
														Project: <span class="font-medium"
															>{event.projectTitle || event.projectId || 'Unknown'}</span
														>
													</div>
													<div>Online: {event.isOnline ? 'Yes' : 'No'}</div>

													<div>
														<span class="font-medium">Agents ({event.agents.length}):</span>
														<div class="mt-1 space-y-1">
															{#each event.agents as agent, idx (`wire-${event.id}-${agent.pubkey}-${idx}`)}
																{@const agentKey = `wire-${event.id}-${agent.pubkey}-${idx}`}
																{@const isExpanded = expandedAgents.has(agentKey)}
																{@const hasTools = agent.tools && agent.tools.length > 0}
																<div class="ml-2 {hasTools ? 'border rounded' : ''}">
																	<div
																		class="flex items-center gap-2 flex-wrap {hasTools
																			? 'p-1 cursor-pointer hover:bg-gray-50'
																			: ''}"
																		onclick={() => hasTools && toggleAgentExpanded(agentKey)}
																		role={hasTools ? 'button' : undefined}
																		tabindex={hasTools ? 0 : undefined}
																	>
																		<span class="font-mono text-xs">{agent.pubkey.slice(0, 6)}...</span>
																		<span>{agent.name}</span>
																		{#if agent.isGlobal}
																			<span class="text-xs px-1 py-0.5 bg-gray-200 rounded"
																				>Global</span
																			>
																		{/if}
																		{#if agent.model}
																			<span class="text-xs px-1 py-0.5 border rounded"
																				>{agent.model}</span
																			>
																		{/if}
																		{#if hasTools}
																			<span class="text-xs px-1 py-0.5 border rounded">
																				{isExpanded ? '▼' : '▶'} {agent.tools?.length || 0} tools
																			</span>
																		{/if}
																	</div>
																	{#if hasTools && isExpanded}
																		<div class="border-t p-1 bg-gray-50">
																			<div class="flex flex-wrap gap-1">
																				{#each agent.tools as tool}
																					<span class="text-xs px-1 py-0.5 bg-gray-200 rounded"
																						>{tool}</span
																					>
																				{/each}
																			</div>
																		</div>
																	{/if}
																</div>
															{/each}
														</div>
													</div>

													<div>
														<span class="font-medium">Models ({event.models.length}):</span>
														<div class="flex gap-1 mt-1 ml-2 flex-wrap">
															{#each event.models as model}
																<span class="text-xs px-1.5 py-0.5 border rounded"
																	>{model.name}</span
																>
															{/each}
														</div>
													</div>
												</div>
											</div>
										{/each}
									{:else}
										<div class="text-center text-gray-500 py-8">
											No wire feed events for this project yet
										</div>
									{/if}
								</div>
							</div>
						</div>
					</div>
				{:else if activeTab === 'store'}
					<!-- Centralized Store Only -->
					<div class="h-full overflow-y-auto p-6">
						<div class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
							{#each projects as project (project.dTag)}
								{@const status = projectStatusMap.get(project.dTag || '')}
								<div class="border border-gray-200 rounded p-4">
									<h3 class="font-medium mb-2">{project.title || project.dTag}</h3>
									{#if status}
										<div class="space-y-2 text-sm">
											<div class="flex items-center gap-2">
												<span
													>Online: {status.isOnline ? 'Yes' : 'No'}{#if status.lastSeen}
														(Last seen: {formatTimeAgo(status.lastSeen)} ago)
													{/if}</span
												>
											</div>
											<div>Agents: {status.agents.length}</div>
											<div>Models: {status.models.length}</div>
											<div>
												Tools: {status.agents.flatMap((a) => a.tools || []).length} total
											</div>
										</div>
									{:else}
										<div class="text-gray-500 text-sm">No status data</div>
									{/if}
								</div>
							{/each}
						</div>
					</div>
				{:else if activeTab === 'wire'}
					<!-- Wire Feed Only -->
					<div class="h-full overflow-y-auto p-6">
						<div class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
							{#each wireFeedEvents as event (event.id)}
								<div class="border border-gray-200 rounded p-4">
									<div class="flex items-center justify-between mb-2">
										<div>
											<span class="font-medium">Event {event.id.slice(0, 8)}...</span>
											<div class="text-sm text-gray-500 mt-0.5">
												{event.projectTitle || event.projectId || 'Unknown Project'}
											</div>
										</div>
										<span class="text-sm text-gray-500">
											{formatTimeAgo(event.timestamp)} ago
										</span>
									</div>
									<div class="space-y-1 text-sm">
										<div>Online: {event.isOnline ? 'Yes' : 'No'}</div>
										<div>Agents: {event.agents?.length || 0}</div>
										<div>Models: {event.models?.length || 0}</div>
										<details class="mt-2">
											<summary class="cursor-pointer text-gray-500">Raw Event Tags</summary>
											<pre
												class="mt-2 p-2 bg-gray-900 text-green-400 rounded text-xs overflow-x-auto">{JSON.stringify(
													event.rawEvent.tags,
													null,
													2
												)}</pre>
										</details>
									</div>
								</div>
							{/each}
						</div>
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}
