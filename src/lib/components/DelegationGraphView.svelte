<script lang="ts">
	import { untrack } from 'svelte';
	import { ndk } from '$lib/ndk.svelte';
	import type { NDKEvent } from '@nostr-dev-kit/ndk';
	import type { NDKProject } from '$lib/events/NDKProject';
	import { openProjects } from '$lib/stores/openProjects.svelte';
	import { conversationMetadataStore } from '$lib/stores/conversationMetadata.svelte';
	import { windowManager } from '$lib/stores/windowManager.svelte';
	import { threadStore, getProjectTagId } from '$lib/stores/threadStore.svelte';
	import { parseAskQuestions } from '$lib/utils/askTags';
	import { generateColorFromString } from '$lib/utils/colors';
	import { User } from '$lib/ndk/ui/user';
	import { cn } from '$lib/utils/cn';
	import * as d3 from 'd3';
	import { Network, ZoomIn, ZoomOut, Maximize2, MessageSquare, HelpCircle, X } from 'lucide-svelte';
	import TimeAgo from '$lib/components/common/TimeAgo.svelte';
	import AskQuestionsBlock from '$lib/components/chat/AskQuestionsBlock.svelte';

	// Layout constants
	const NODE_WIDTH = 240;
	const NODE_HEIGHT = 160;
	const ASK_NODE_WIDTH = 200;
	const ASK_NODE_HEIGHT = 80;
	const ZOOM_MIN = 0.2;
	const ZOOM_MAX = 3;

	interface GraphNode {
		id: string;
		type: 'conversation' | 'ask';
		event: NDKEvent;
		project?: NDKProject;
		title: string;
		summary?: string;
		senderPubkey?: string;
		recipientPubkey?: string;
		statusLabel?: string;
		isAnswered?: boolean;
		latestReplyTime: number;
		x?: number;
		y?: number;
	}

	interface GraphLink {
		source: string;
		target: string;
		type: 'delegation' | 'ask';
	}

	// DOM references
	let svgElement: SVGSVGElement | undefined = $state();
	let containerElement: HTMLDivElement | undefined = $state();

	// State
	let transform = $state('translate(0, 0) scale(1)');
	let nodes = $state<GraphNode[]>([]);
	let links = $state<GraphLink[]>([]);

	// Derived lookup for O(1) node access
	const nodeById = $derived.by(() => {
		const map: Record<string, GraphNode> = {};
		for (const n of nodes) map[n.id] = n;
		return map;
	});

	// Non-reactive D3 objects - must NOT be $state to avoid reactivity issues
	let zoomBehavior: d3.ZoomBehavior<SVGSVGElement, unknown> | null = null;
	let isInitialized = false;

	// Ask modal state
	let askModalOpen = $state(false);
	let selectedAskEvent = $state<NDKEvent | null>(null);

	// Build project lookup map for filtered threads
	const projectByTagId = $derived.by(() => {
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- rebuilt each derivation
		const map = new Map<string, NDKProject>();
		for (const project of openProjects.projects) {
			const tagId = project.tagId();
			if (tagId) map.set(tagId, project);
		}
		return map;
	});

	// Build graph data from threadStore
	$effect(() => {
		const filteredThreads = threadStore.filteredThreads;
		const delegationLinks = threadStore.delegationLinks;
		const askEvents = threadStore.askEvents;
		const metadata = threadStore.threadMetadata;

		const graphNodes: GraphNode[] = [];
		const graphLinks: GraphLink[] = [];
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- local variable rebuilt each effect run
		const nodeIds = new Set<string>();

		// Build conversation nodes from filtered threads
		for (const thread of filteredThreads) {
			const projectTagId = getProjectTagId(thread);
			const project = projectTagId ? projectByTagId.get(projectTagId) : undefined;

			const convMetadata = conversationMetadataStore.getConversationData(thread.id);
			const threadMeta = metadata.get(thread.id);
			const latestReplyTime = threadMeta?.latestReply?.created_at || thread.created_at || 0;

			graphNodes.push({
				id: thread.id,
				type: 'conversation',
				event: thread,
				project,
				title:
					convMetadata.title ||
					thread.tagValue('title') ||
					thread.content?.slice(0, 50) ||
					'Untitled',
				summary: convMetadata.summary,
				senderPubkey: thread.pubkey,
				recipientPubkey: thread.tags.find((t) => t[0] === 'p')?.[1],
				statusLabel: convMetadata.statusLabel,
				latestReplyTime
			});
			nodeIds.add(thread.id);
		}

		// Build delegation links from threadStore
		for (const [sourceId, targetIds] of delegationLinks) {
			if (!nodeIds.has(sourceId)) continue;
			for (const targetId of targetIds) {
				graphLinks.push({
					source: sourceId,
					target: targetId,
					type: 'delegation'
				});
			}
		}

		// Build ask nodes from threadStore
		for (const askInfo of askEvents) {
			if (!nodeIds.has(askInfo.parentConversationId)) continue;

			graphNodes.push({
				id: askInfo.event.id,
				type: 'ask',
				event: askInfo.event,
				title: askInfo.title,
				senderPubkey: askInfo.event.pubkey,
				isAnswered: askInfo.isAnswered,
				latestReplyTime: askInfo.event.created_at || 0
			});
			nodeIds.add(askInfo.event.id);

			// Link ask to its parent conversation
			graphLinks.push({
				source: askInfo.parentConversationId,
				target: askInfo.event.id,
				type: 'ask'
			});
		}

		// Filter links to only include those with valid nodes
		const validLinks = graphLinks.filter(
			(link) => nodeIds.has(link.source) && nodeIds.has(link.target)
		);

		nodes = graphNodes;
		links = validLinks;
	});

	// Setup zoom behavior once when SVG is available
	$effect(() => {
		if (!svgElement || !containerElement || isInitialized) return;

		const width = containerElement.clientWidth;
		const height = containerElement.clientHeight;

		const svg = d3.select(svgElement);
		const zoom = d3
			.zoom<SVGSVGElement, unknown>()
			.scaleExtent([ZOOM_MIN, ZOOM_MAX])
			.on('zoom', (event) => {
				transform = event.transform.toString();
			});

		svg.call(zoom);
		svg.call(zoom.transform, d3.zoomIdentity.translate(width / 2, height / 2).scale(0.8));
		zoomBehavior = zoom;
		isInitialized = true;

		return () => {
			svg.on('.zoom', null);
			isInitialized = false;
			zoomBehavior = null;
		};
	});

	// Derive a structural key that changes only when graph structure changes
	const layoutKey = $derived(
		nodes.map((n) => n.id).join(',') + '|' + links.map((l) => `${l.source}-${l.target}`).join(',')
	);

	// Compute static tree layout when structure changes
	$effect(() => {
		const key = layoutKey; // Track structural changes only
		if (!containerElement || !key) return;

		// Use untrack to read/write nodes without creating a dependency cycle
		untrack(() => {
			if (nodes.length === 0) return;
			const width = containerElement!.clientWidth;

			// Build parent map from links
			const parentMap: Record<string, string> = {};
			for (const link of links) {
				parentMap[link.target] = link.source;
			}

			// Find root nodes (no parent)
			const roots = nodes.filter((n) => !(n.id in parentMap));

			// If no roots found, treat all conversation nodes as roots
			const effectiveRoots =
				roots.length > 0 ? roots : nodes.filter((n) => n.type === 'conversation');

			if (effectiveRoots.length === 0) return;

			// Build hierarchy data for d3.stratify
			// Add a virtual root if multiple roots exist
			const hierarchyData: { id: string; parentId: string | null; node?: GraphNode }[] = [];

			if (effectiveRoots.length > 1) {
				// Virtual root to connect multiple trees
				hierarchyData.push({ id: '__root__', parentId: null });
				for (const root of effectiveRoots) {
					hierarchyData.push({ id: root.id, parentId: '__root__', node: root });
				}
			} else {
				hierarchyData.push({ id: effectiveRoots[0].id, parentId: null, node: effectiveRoots[0] });
			}

			// Add remaining nodes with their parents
			for (const node of nodes) {
				if (effectiveRoots.includes(node)) continue;
				const parentId = parentMap[node.id];
				if (parentId) {
					hierarchyData.push({ id: node.id, parentId, node });
				}
			}

			// Create hierarchy using stratify
			const stratify = d3
				.stratify<{ id: string; parentId: string | null; node?: GraphNode }>()
				.id((d) => d.id)
				.parentId((d) => d.parentId);

			let root;
			try {
				root = stratify(hierarchyData);
			} catch {
				// If stratify fails (cycles, missing parents), fall back to simple grid
				const cols = Math.ceil(Math.sqrt(nodes.length));
				for (let i = 0; i < nodes.length; i++) {
					nodes[i].x = (i % cols) * (NODE_WIDTH + 50) + NODE_WIDTH;
					nodes[i].y = Math.floor(i / cols) * (NODE_HEIGHT + 50) + NODE_HEIGHT;
				}
				nodes = [...nodes];
				return;
			}

			// Create tree layout
			const treeLayout = d3
				.tree<{ id: string; parentId: string | null; node?: GraphNode }>()
				.nodeSize([NODE_WIDTH + 60, NODE_HEIGHT + 80]);

			treeLayout(root);

			// Apply positions from tree layout to our nodes
			const localNodeById: Record<string, GraphNode> = {};
			for (const n of nodes) localNodeById[n.id] = n;

			for (const d of root.descendants()) {
				const dx = d.x;
				const dy = d.y;
				if (d.data.node && d.data.id !== '__root__' && dx !== undefined && dy !== undefined) {
					const node = localNodeById[d.data.id];
					if (node) {
						// Tree layout gives x as horizontal spread, y as depth
						node.x = dx + width / 2;
						node.y = dy + 100;
					}
				}
			}

			// Trigger reactivity for rendering
			nodes = [...nodes];
		});
	});

	function handleZoomIn() {
		if (!svgElement || !zoomBehavior) return;
		d3.select(svgElement).transition().duration(300).call(zoomBehavior.scaleBy, 1.5);
	}

	function handleZoomOut() {
		if (!svgElement || !zoomBehavior) return;
		d3.select(svgElement).transition().duration(300).call(zoomBehavior.scaleBy, 0.67);
	}

	function handleResetView() {
		if (!svgElement || !zoomBehavior || !containerElement) return;
		const width = containerElement.clientWidth;
		const height = containerElement.clientHeight;
		d3
			.select(svgElement)
			.transition()
			.duration(300)
			.call(zoomBehavior.transform, d3.zoomIdentity.translate(width / 2, height / 2).scale(0.8));
	}

	function handleNodeClick(node: GraphNode) {
		if (node.type === 'ask' && !node.isAnswered) {
			selectedAskEvent = node.event;
			askModalOpen = true;
		} else if (node.type === 'conversation' && node.project) {
			windowManager.openChat(node.project, node.event);
		}
	}

	function getNodeX(node: GraphNode): number {
		return (node.x ?? 0) - (node.type === 'ask' ? ASK_NODE_WIDTH / 2 : NODE_WIDTH / 2);
	}

	function getNodeY(node: GraphNode): number {
		return (node.y ?? 0) - (node.type === 'ask' ? ASK_NODE_HEIGHT / 2 : NODE_HEIGHT / 2);
	}

	function getLinkPath(link: GraphLink): string {
		const source = nodeById[link.source];
		const target = nodeById[link.target];
		if (!source || !target) return '';

		const sx = source.x ?? 0;
		const sy = source.y ?? 0;
		const tx = target.x ?? 0;
		const ty = target.y ?? 0;

		// Curved path from source to target
		const midY = (sy + ty) / 2;
		return `M ${sx} ${sy} Q ${sx} ${midY}, ${tx} ${ty}`;
	}
</script>

<div class="flex-1 flex flex-col h-full overflow-hidden bg-background relative">
	<!-- Header -->
	<div class="p-6 pb-0">
		<h1 class="text-2xl font-bold text-foreground mb-2">Delegation Graph</h1>
		<p class="text-muted-foreground text-sm">
			Visual map of conversation delegations and pending questions
		</p>
	</div>

	<!-- Controls -->
	<div class="absolute top-20 right-4 z-10 flex flex-col gap-1">
		<button
			class="p-2 rounded-md bg-card border border-border hover:bg-accent transition-colors"
			onclick={handleZoomIn}
			aria-label="Zoom in"
			title="Zoom in"
		>
			<ZoomIn class="h-4 w-4" />
		</button>
		<button
			class="p-2 rounded-md bg-card border border-border hover:bg-accent transition-colors"
			onclick={handleZoomOut}
			aria-label="Zoom out"
			title="Zoom out"
		>
			<ZoomOut class="h-4 w-4" />
		</button>
		<button
			class="p-2 rounded-md bg-card border border-border hover:bg-accent transition-colors"
			onclick={handleResetView}
			aria-label="Reset view"
			title="Reset view"
		>
			<Maximize2 class="h-4 w-4" />
		</button>
	</div>

	<!-- Legend -->
	<div class="absolute top-20 left-4 z-10 bg-card/95 border border-border rounded-lg p-3">
		<h4 class="text-xs text-muted-foreground uppercase tracking-wider mb-2">Legend</h4>
		<div class="flex flex-col gap-1.5 text-xs">
			<div class="flex items-center gap-2">
				<div class="w-4 h-3 rounded-sm bg-card border-2 border-primary"></div>
				<span>Conversation</span>
			</div>
			<div class="flex items-center gap-2">
				<div class="w-4 h-3 rounded-sm bg-purple-500/20 border-2 border-purple-500"></div>
				<span>Unanswered Question</span>
			</div>
			<div class="flex items-center gap-2">
				<div class="w-4 h-3 rounded-sm bg-muted border-2 border-muted-foreground"></div>
				<span>Answered Question</span>
			</div>
			<div class="flex items-center gap-2 mt-1">
				<div class="w-6 h-0.5 bg-primary"></div>
				<span>Delegation</span>
			</div>
			<div class="flex items-center gap-2">
				<div class="w-6 h-0.5 bg-purple-500 border-dashed" style="border-top: 2px dashed"></div>
				<span>Question Link</span>
			</div>
		</div>
	</div>

	<!-- Graph Area -->
	<div class="flex-1 overflow-hidden relative" bind:this={containerElement}>
		{#if nodes.length === 0}
			<div class="absolute inset-0 flex items-center justify-center">
				<div class="text-center text-muted-foreground">
					<Network class="h-16 w-16 mx-auto mb-4 opacity-50" />
					<h2 class="text-xl font-semibold text-foreground mb-2">No conversations to display</h2>
					<p class="text-sm">Open projects and create conversations to see the delegation graph</p>
				</div>
			</div>
		{:else}
			<svg bind:this={svgElement} class="w-full h-full" style="cursor: grab;">
				<defs>
					<marker
						id="arrow-delegation"
						markerWidth="10"
						markerHeight="7"
						refX="9"
						refY="3.5"
						orient="auto"
					>
						<polygon points="0 0, 10 3.5, 0 7" class="fill-primary" />
					</marker>
					<marker
						id="arrow-ask"
						markerWidth="10"
						markerHeight="7"
						refX="9"
						refY="3.5"
						orient="auto"
					>
						<polygon points="0 0, 10 3.5, 0 7" class="fill-purple-500" />
					</marker>
				</defs>

				<g {transform}>
					<!-- Links -->
					{#each links as link (`${link.source}-${link.target}`)}
						<path
							d={getLinkPath(link)}
							fill="none"
							class={link.type === 'delegation' ? 'stroke-primary' : 'stroke-purple-500'}
							stroke-width="2"
							stroke-dasharray={link.type === 'ask' ? '8, 4' : 'none'}
							marker-end={link.type === 'delegation' ? 'url(#arrow-delegation)' : 'url(#arrow-ask)'}
						/>
					{/each}

					<!-- Nodes -->
					{#each nodes as node (node.id)}
						<g
							transform="translate({getNodeX(node)}, {getNodeY(node)})"
							class="cursor-pointer"
							onclick={() => handleNodeClick(node)}
							onkeydown={(e) => e.key === 'Enter' && handleNodeClick(node)}
							role="button"
							tabindex="0"
						>
							{#if node.type === 'conversation'}
								<!-- Conversation Card -->
								<rect
									width={NODE_WIDTH}
									height={NODE_HEIGHT}
									rx="8"
									class="fill-card stroke-2"
									style="stroke: {node.statusLabel ? generateColorFromString(node.statusLabel) : 'hsl(var(--border))'}"
								/>

								<!-- Status indicator -->
								{#if node.statusLabel}
									<rect
										x="0"
										y="0"
										width="4"
										height={NODE_HEIGHT}
										rx="2"
										style="fill: {generateColorFromString(node.statusLabel)}"
									/>
								{/if}

								<!-- Title -->
								<foreignObject x="12" y="8" width={NODE_WIDTH - 24} height="24">
									<div class="text-sm font-medium text-foreground truncate">
										{node.title}
									</div>
								</foreignObject>

								<!-- Sender and recipient avatars -->
								<foreignObject x="12" y="36" width={NODE_WIDTH - 24} height="32">
									<div class="flex items-center gap-2">
										<div class="flex items-center flex-shrink-0">
											{#if node.senderPubkey}
												<User.Root ndk={ndk} pubkey={node.senderPubkey}>
													<User.Avatar class="w-6 h-6 rounded-full ring-2 ring-card" />
												</User.Root>
											{/if}
											{#if node.recipientPubkey}
												<User.Root ndk={ndk} pubkey={node.recipientPubkey}>
													<User.Avatar class="w-6 h-6 rounded-full ring-2 ring-card -ml-2" />
												</User.Root>
											{/if}
										</div>
										{#if node.statusLabel}
											<span
												class="text-xs px-2 py-0.5 rounded-full truncate"
												style="background-color: {generateColorFromString(node.statusLabel).replace(')', ', 0.2)')}; color: {generateColorFromString(node.statusLabel)}"
											>
												{node.statusLabel}
											</span>
										{/if}
									</div>
								</foreignObject>

								<!-- Summary (up to 4 lines) -->
								{#if node.summary}
									<foreignObject x="12" y="72" width={NODE_WIDTH - 24} height="64">
										<div class="text-xs text-muted-foreground italic line-clamp-4">
											{node.summary}
										</div>
									</foreignObject>
								{/if}

								<!-- Time -->
								<foreignObject x="12" y={NODE_HEIGHT - 24} width={NODE_WIDTH - 24} height="20">
									<div class="flex items-center gap-2 text-xs text-muted-foreground">
										<MessageSquare class="w-3 h-3" />
										<TimeAgo timestamp={node.latestReplyTime} />
									</div>
								</foreignObject>
							{:else}
								<!-- Ask Card -->
								<rect
									width={ASK_NODE_WIDTH}
									height={ASK_NODE_HEIGHT}
									rx="8"
									class={cn(
										'stroke-2',
										node.isAnswered
											? 'fill-muted stroke-muted-foreground'
											: 'fill-purple-500/10 stroke-purple-500'
									)}
								/>

								<!-- Pulsing indicator for unanswered -->
								{#if !node.isAnswered}
									<circle cx={ASK_NODE_WIDTH - 12} cy="12" r="4" class="fill-purple-500 animate-pulse" />
								{/if}

								<!-- Question icon -->
								<foreignObject x="12" y="12" width="20" height="20">
									<HelpCircle
										class={cn('w-5 h-5', node.isAnswered ? 'text-muted-foreground' : 'text-purple-500')}
									/>
								</foreignObject>

								<!-- Title -->
								<foreignObject x="36" y="12" width={ASK_NODE_WIDTH - 48} height="24">
									<div
										class={cn(
											'text-sm font-medium truncate',
											node.isAnswered ? 'text-muted-foreground' : 'text-purple-500'
										)}
									>
										{node.title}
									</div>
								</foreignObject>

								<!-- Status -->
								<foreignObject x="12" y={ASK_NODE_HEIGHT - 28} width={ASK_NODE_WIDTH - 24} height="20">
									<div class="text-xs text-muted-foreground">
										{node.isAnswered ? 'Answered' : 'Awaiting response'}
									</div>
								</foreignObject>
							{/if}
						</g>
					{/each}
				</g>
			</svg>

			<div class="absolute bottom-4 left-4 text-xs text-muted-foreground bg-card/80 px-2 py-1 rounded">
				Scroll to zoom &bull; Drag to pan &bull; Click to interact
			</div>
		{/if}
	</div>
</div>

<!-- Ask Question Modal -->
{#if askModalOpen && selectedAskEvent}
	{@const questions = parseAskQuestions(selectedAskEvent)}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-overlay/50"
		onclick={() => (askModalOpen = false)}
		onkeydown={(e) => e.key === 'Escape' && (askModalOpen = false)}
		role="presentation"
	>
		<div
			class="relative w-full max-w-lg max-h-[90vh] bg-card rounded-lg shadow-xl flex flex-col overflow-hidden"
			onclick={(e) => e.stopPropagation()}
			role="dialog"
			aria-modal="true"
			tabindex="-1"
		>
			<!-- Header -->
			<div class="flex items-center justify-between px-6 py-4 border-b border-border">
				<h2 class="text-lg font-semibold">Pending Question</h2>
				<button
					onclick={() => (askModalOpen = false)}
					class="text-muted-foreground hover:text-foreground"
					aria-label="Close"
				>
					<X class="w-5 h-5" />
				</button>
			</div>

			<!-- Content -->
			<div class="flex-1 overflow-y-auto p-6">
				{#if questions}
					<AskQuestionsBlock
						{questions}
						content={selectedAskEvent.content}
						askEvent={selectedAskEvent}
					/>
				{/if}
			</div>
		</div>
	</div>
{/if}
