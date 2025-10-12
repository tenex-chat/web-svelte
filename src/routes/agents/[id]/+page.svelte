<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { ndk } from '$lib/ndk.svelte';
	import { NDKAgentDefinition } from '$lib/events/NDKAgentDefinition';
	import { NDKMCPTool } from '$lib/events/NDKMCPTool';
	import { generateAgentColor } from '$lib/utils/agent-colors';
	import CreateAgentDialog from '$lib/components/dialogs/CreateAgentDialog.svelte';
	import { marked } from 'marked';

	const agentId = $derived($page.params.id);

	const currentUser = $derived(ndk.$sessions.currentUser);

	const agentEventSub = ndk.$subscribe(
		() => (agentId ? { ids: [agentId], kinds: [NDKAgentDefinition.kind] } : undefined),
		{ closeOnEose: true }
	);

	const agent = $derived.by(() => {
		const events = agentEventSub.events || [];
		if (events.length === 0) return null;
		return NDKAgentDefinition.from(events[0]);
	});

	const mcpEventIds = $derived(agent?.mcpServers || []);

	const mcpEventsSub = ndk.$subscribe(
		() => (mcpEventIds.length > 0 ? { ids: mcpEventIds, kinds: [4200] } : undefined),
		{ closeOnEose: true }
	);

	const mcpTools = $derived.by(() => {
		const events = mcpEventsSub.events || [];
		return events.map((event) => NDKMCPTool.from(event));
	});

	const agentColor = $derived(agent ? generateAgentColor(agent.name || agent.id) : '');
	const initials = $derived(agent?.name ? agent.name.slice(0, 2).toUpperCase() : 'AG');

	let activeTab = $state<'details' | 'phases'>('details');
	let forkDialogOpen = $state(false);
	let cloneDialogOpen = $state(false);
	let copiedId = $state(false);
	let actionsOpen = $state(false);

	let forkAgent = $state<NDKAgentDefinition | undefined>(undefined);
	let cloneMode = $state(false);

	async function handleCopyId() {
		if (!agent) return;
		try {
			await navigator.clipboard.writeText(agent.id);
			copiedId = true;
			setTimeout(() => (copiedId = false), 2000);
		} catch (error) {
			console.error('Failed to copy ID:', error);
		}
	}

	function handleFork() {
		if (agent) {
			forkAgent = agent;
			cloneMode = false;
			forkDialogOpen = true;
		}
		actionsOpen = false;
	}

	function handleClone() {
		if (agent) {
			forkAgent = agent;
			cloneMode = true;
			cloneDialogOpen = true;
		}
		actionsOpen = false;
	}

	function renderMarkdown(content: string): string {
		return marked(content, { breaks: true });
	}
</script>

<div class="flex-1 flex flex-col">
	{#if !agent}
		<div class="flex-1 flex items-center justify-center">
			<div class="text-center">
				<svg
					class="w-12 h-12 text-gray-400 mx-auto mb-4"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
					/>
				</svg>
				<h3 class="text-lg font-medium text-gray-900 mb-1">Agent definition not found</h3>
				<p class="text-sm text-gray-500 mb-4">This agent definition could not be found.</p>
				<button
					onclick={() => goto('/agents')}
					class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
				>
					Back to Agent Definitions
				</button>
			</div>
		</div>
	{:else}
		<!-- Header -->
		<div class="bg-white border-b border-gray-200">
			<div class="max-w-4xl mx-auto px-4 py-4">
				<div class="flex items-center gap-4 mb-4">
					<button
						onclick={() => goto('/agents')}
						class="p-2 hover:bg-gray-100 rounded-md transition-colors"
					>
						<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M15 19l-7-7 7-7"
							/>
						</svg>
					</button>
					<div
						class="w-16 h-16 rounded-full flex items-center justify-center text-white font-semibold text-xl flex-shrink-0"
						style="background-color: {agentColor}"
					>
						{#if agent.picture}
							<img src={agent.picture} alt={agent.name} class="w-full h-full rounded-full object-cover" />
						{:else}
							{initials}
						{/if}
					</div>
					<div class="flex-1">
						<h1 class="text-2xl font-semibold text-gray-900">
							{agent.name || 'Unnamed Agent Definition'}
						</h1>
						<div class="flex items-center gap-2 mt-1">
							{#if agent.role}
								<span class="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded">{agent.role}</span>
							{/if}
							<button
								onclick={handleCopyId}
								class="text-xs text-gray-500 hover:text-gray-700 font-mono flex items-center gap-1"
							>
								{agent.id.slice(0, 8)}...{agent.id.slice(-8)}
								{#if copiedId}
									<svg class="w-3 h-3 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
									</svg>
								{:else}
									<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
										/>
									</svg>
								{/if}
							</button>
						</div>
					</div>
					<div class="relative">
						<button
							onclick={() => (actionsOpen = !actionsOpen)}
							class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center gap-2"
						>
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
							</svg>
							Actions
						</button>
						{#if actionsOpen}
							<div
								class="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-10"
							>
								<button
									onclick={handleFork}
									class="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2"
								>
									<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
										/>
									</svg>
									Fork
								</button>
								<button
									onclick={handleClone}
									class="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2"
								>
									<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
										/>
									</svg>
									Clone
								</button>
							</div>
						{/if}
					</div>
				</div>
			</div>
		</div>

		<!-- Tabs -->
		<div class="border-b border-gray-200">
			<div class="max-w-4xl mx-auto px-4">
				<div class="flex gap-4">
					<button
						onclick={() => (activeTab = 'details')}
						class="px-4 py-3 border-b-2 {activeTab === 'details'
							? 'border-blue-600 text-blue-600'
							: 'border-transparent text-gray-500 hover:text-gray-700'} transition-colors"
					>
						Details
					</button>
					{#if agent.phases && agent.phases.length > 0}
						<button
							onclick={() => (activeTab = 'phases')}
							class="px-4 py-3 border-b-2 {activeTab === 'phases'
								? 'border-blue-600 text-blue-600'
								: 'border-transparent text-gray-500 hover:text-gray-700'} transition-colors"
						>
							Phases ({agent.phases.length})
						</button>
					{/if}
				</div>
			</div>
		</div>

		<!-- Content -->
		<div class="flex-1 overflow-y-auto bg-gray-50">
			<div class="max-w-4xl mx-auto p-4 space-y-4">
				{#if activeTab === 'details'}
					<!-- Description -->
					<div class="bg-white rounded-lg border border-gray-200 p-6">
						<h3 class="font-semibold text-gray-900 mb-2">Description</h3>
						<p class="text-gray-700">{agent.description || 'No description provided'}</p>
					</div>

					<!-- Instructions -->
					{#if agent.instructions}
						<div class="bg-white rounded-lg border border-gray-200 p-6">
							<h3 class="font-semibold text-gray-900 mb-2">Instructions</h3>
							<p class="text-sm text-gray-500 mb-4">The prompt that defines this agent's behavior</p>
							<div class="prose prose-sm max-w-none">
								{@html renderMarkdown(agent.instructions)}
							</div>
						</div>
					{/if}

					<!-- Use Criteria -->
					{#if agent.useCriteria && agent.useCriteria.length > 0}
						<div class="bg-white rounded-lg border border-gray-200 p-6">
							<h3 class="font-semibold text-gray-900 mb-2">Use Criteria</h3>
							<p class="text-sm text-gray-500 mb-4">When this agent should be used</p>
							<ul class="space-y-2">
								{#each agent.useCriteria as criteria}
									<li class="flex items-start gap-2">
										<span class="text-gray-400">•</span>
										<span class="text-gray-700">{criteria}</span>
									</li>
								{/each}
							</ul>
						</div>
					{/if}

					<!-- Tools & MCP Servers -->
					<div class="bg-white rounded-lg border border-gray-200 p-6">
						<h3 class="font-semibold text-gray-900 mb-4">Tools & Capabilities</h3>

						<!-- Direct Tools -->
						<div class="mb-4">
							<div class="flex items-center gap-2 mb-2">
								<svg class="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
									/>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
									/>
								</svg>
								<span class="text-sm font-medium text-gray-700">Direct Tools</span>
							</div>
							{#if agent.tools.length > 0}
								<div class="flex flex-wrap gap-2">
									{#each agent.tools as tool}
										<span class="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded border border-gray-200">
											{tool}
										</span>
									{/each}
								</div>
							{:else}
								<p class="text-sm text-gray-500">No direct tools configured</p>
							{/if}
						</div>

						<!-- MCP Servers -->
						<div>
							<div class="flex items-center gap-2 mb-2">
								<svg class="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"
									/>
								</svg>
								<span class="text-sm font-medium text-gray-700">MCP Servers</span>
							</div>
							{#if mcpTools.length > 0}
								<div class="space-y-2">
									{#each mcpTools as mcp}
										<div class="border border-gray-200 rounded-lg p-3">
											<h4 class="font-medium text-sm text-gray-900">
												{mcp.name || 'Unnamed MCP Server'}
											</h4>
											{#if mcp.description}
												<p class="text-xs text-gray-500 mt-1">{mcp.description}</p>
											{/if}
											{#if mcp.command}
												<code class="text-xs bg-gray-50 px-2 py-0.5 rounded mt-2 inline-block"
													>{mcp.command}</code
												>
											{/if}
										</div>
									{/each}
								</div>
							{:else}
								<p class="text-sm text-gray-500">No MCP servers configured</p>
							{/if}
						</div>
					</div>

					<!-- Metadata -->
					<div class="bg-white rounded-lg border border-gray-200 p-6">
						<h3 class="font-semibold text-gray-900 mb-4">Metadata</h3>
						<div class="space-y-2 text-sm">
							<div class="flex justify-between">
								<span class="text-gray-500">Author:</span>
								<span class="font-mono text-gray-700">{agent.pubkey.slice(0, 16)}...</span>
							</div>
							<div class="flex justify-between">
								<span class="text-gray-500">Created:</span>
								<span class="text-gray-700">
									{agent.created_at ? new Date(agent.created_at * 1000).toLocaleString() : 'Unknown'}
								</span>
							</div>
							<div class="flex justify-between">
								<span class="text-gray-500">Event Kind:</span>
								<span class="text-gray-700">{agent.kind}</span>
							</div>
							{#if agent.version}
								<div class="flex justify-between">
									<span class="text-gray-500">Version:</span>
									<span class="text-gray-700">{agent.version}</span>
								</div>
							{/if}
						</div>
					</div>
				{:else if activeTab === 'phases' && agent.phases}
					<!-- Phases Tab -->
					<div class="space-y-4">
						{#each agent.phases as phase, index}
							<div class="bg-white rounded-lg border border-gray-200 p-6">
								<div class="flex items-center gap-2 mb-2">
									<span class="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded">Phase {index + 1}</span>
									<h3 class="font-semibold text-gray-900">{phase.name}</h3>
								</div>
								<div class="prose prose-sm max-w-none">
									{@html renderMarkdown(phase.instructions)}
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>

{#if forkAgent}
	<CreateAgentDialog bind:open={forkDialogOpen} {forkAgent} {cloneMode} />
{/if}

{#if forkAgent && cloneMode}
	<CreateAgentDialog bind:open={cloneDialogOpen} {forkAgent} {cloneMode} />
{/if}
