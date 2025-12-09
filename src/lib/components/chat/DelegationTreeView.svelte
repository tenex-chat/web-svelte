<script lang="ts">
	import type { NDKEvent, NDKUserProfile } from '@nostr-dev-kit/ndk';
	import type { Message } from '$lib/utils/messageUtils';
	import { ndk } from '$lib/ndk.svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import * as d3 from 'd3';
	import { GitFork, ZoomIn, ZoomOut, Maximize2, Loader2 } from 'lucide-svelte';

	// Layout constants
	const NODE_WIDTH = 220;
	const NODE_HEIGHT = 90;
	const NODE_SPACING_X = 40;
	const NODE_SPACING_Y = 120;
	const INITIAL_TRANSLATE_X = 50;
	const INITIAL_TRANSLATE_Y = 50;
	const ZOOM_MIN = 0.1;
	const ZOOM_MAX = 4;
	const CONTENT_MAX_LENGTH = 100;

	interface TreeNode {
		id: string;
		event: NDKEvent;
		children: TreeNode[];
		profile?: NDKUserProfile;
		isRoot: boolean;
		isCurrentUser: boolean;
	}

	interface Props {
		rootEvent: NDKEvent;
		messages: Message[];
		isLoading?: boolean;
		currentUserPubkey?: string;
		onNodeClick?: (event: NDKEvent) => void;
	}

	let {
		rootEvent,
		messages,
		isLoading = false,
		currentUserPubkey = ndk.$currentUser?.pubkey,
		onNodeClick
	}: Props = $props();

	// DOM references
	let svgElement: SVGSVGElement | undefined = $state();
	let containerElement: HTMLDivElement | undefined = $state();

	// D3 state
	let nodes = $state<d3.HierarchyPointNode<TreeNode>[]>([]);
	let links = $state<d3.HierarchyPointLink<TreeNode>[]>([]);
	let transform = $state(`translate(${INITIAL_TRANSLATE_X}, ${INITIAL_TRANSLATE_Y})`);
	let zoomBehavior = $state<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

	// Profile cache - using SvelteMap for reactivity
	let profileCache = new SvelteMap<string, NDKUserProfile>();

	// Build tree from messages
	function buildTree(messages: Message[], rootId: string): TreeNode | null {
		if (messages.length === 0) return null;

		// Using regular Map here since it's not reactive state, just internal computation
		const nodeMap = new Map<string, TreeNode>();

		// Create nodes for all messages
		for (const message of messages) {
			nodeMap.set(message.id, {
				id: message.id,
				event: message.event,
				children: [],
				profile: profileCache.get(message.event.pubkey),
				isRoot: message.id === rootId,
				isCurrentUser: message.event.pubkey === currentUserPubkey
			});
		}

		// Build parent-child relationships using NIP-10 conventions
		for (const message of messages) {
			if (message.id === rootId) continue;

			const parentId = findParentId(message.event, rootId);
			if (parentId) {
				const parentNode = nodeMap.get(parentId);
				const childNode = nodeMap.get(message.id);
				if (parentNode && childNode) {
					parentNode.children.push(childNode);
				}
			}
		}

		return nodeMap.get(rootId) || null;
	}

	// Find parent event ID following NIP-10 conventions
	function findParentId(event: NDKEvent, rootId: string): string | null {
		const eTags = event.tags.filter((t) => t[0] === 'e');
		if (eTags.length === 0) return null;

		// Look for explicit reply marker first (NIP-10 preferred)
		const replyTag = eTags.find((t) => t[3] === 'reply');
		if (replyTag) return replyTag[1];

		// Look for root marker - in that case, parent is root
		const rootTag = eTags.find((t) => t[3] === 'root');
		if (rootTag && eTags.length === 1) return rootTag[1];

		// NIP-10 positional: last e-tag without marker is reply, first is root
		const unmarkedTags = eTags.filter((t) => !t[3]);
		if (unmarkedTags.length > 0) {
			// If there's only one e-tag, it's the parent
			if (unmarkedTags.length === 1) return unmarkedTags[0][1];
			// Otherwise, last one is the reply target
			return unmarkedTags[unmarkedTags.length - 1][1];
		}

		// If we have a root tag and other tags, the non-root one is parent
		if (rootTag && eTags.length > 1) {
			const nonRootTag = eTags.find((t) => t !== rootTag);
			if (nonRootTag) return nonRootTag[1];
		}

		// Fallback: assume replying to root
		return rootId;
	}

	// Fetch profiles for all unique pubkeys
	async function fetchProfiles(pubkeys: string[]): Promise<void> {
		const uniquePubkeys = [...new Set(pubkeys)].filter((pk) => !profileCache.has(pk));
		if (uniquePubkeys.length === 0) return;

		try {
			const users = await Promise.all(
				uniquePubkeys.map((pk) => ndk.getUser({ pubkey: pk }).fetchProfile())
			);

			for (let i = 0; i < uniquePubkeys.length; i++) {
				const profile = users[i];
				if (profile) {
					profileCache.set(uniquePubkeys[i], profile);
				}
			}
		} catch (error) {
			console.error('Failed to fetch profiles:', error);
		}
	}

	// Fetch profiles when messages change
	$effect(() => {
		if (messages.length > 0) {
			const pubkeys = messages.map((m) => m.event.pubkey);
			fetchProfiles(pubkeys);
		}
	});

	// Build tree whenever messages or profiles change
	const tree = $derived.by(() => {
		if (messages.length === 0) return null;
		return buildTree(messages, rootEvent.id);
	});

	// Calculate layout when tree or container changes
	$effect(() => {
		if (!tree || !containerElement) {
			nodes = [];
			links = [];
			return;
		}

		const width = containerElement.clientWidth || 800;
		const height = containerElement.clientHeight || 600;

		const root = d3.hierarchy(tree, (d) => d.children);
		const treeLayout = d3.tree<TreeNode>().size([
			width - NODE_WIDTH - NODE_SPACING_X * 2,
			height - NODE_HEIGHT - NODE_SPACING_Y
		]);
		const treeData = treeLayout(root);

		nodes = treeData.descendants();
		links = treeData.links();
	});

	// Set up zoom behavior
	$effect(() => {
		if (!svgElement) return;

		const svg = d3.select(svgElement);

		const zoom = d3
			.zoom<SVGSVGElement, unknown>()
			.scaleExtent([ZOOM_MIN, ZOOM_MAX])
			.on('zoom', (event) => {
				transform = event.transform.toString();
			});

		svg.call(zoom);
		svg.call(zoom.transform, d3.zoomIdentity.translate(INITIAL_TRANSLATE_X, INITIAL_TRANSLATE_Y));
		zoomBehavior = zoom;

		return () => {
			svg.on('.zoom', null);
		};
	});

	// Zoom control functions
	function handleZoomIn() {
		if (!svgElement || !zoomBehavior) return;
		d3.select(svgElement).transition().duration(300).call(zoomBehavior.scaleBy, 1.5);
	}

	function handleZoomOut() {
		if (!svgElement || !zoomBehavior) return;
		d3.select(svgElement).transition().duration(300).call(zoomBehavior.scaleBy, 0.67);
	}

	function handleResetView() {
		if (!svgElement || !zoomBehavior) return;
		d3.select(svgElement)
			.transition()
			.duration(300)
			.call(zoomBehavior.transform, d3.zoomIdentity.translate(INITIAL_TRANSLATE_X, INITIAL_TRANSLATE_Y));
	}

	// Generate link path
	function linkPath(link: d3.HierarchyPointLink<TreeNode>): string {
		const path = d3
			.linkVertical<d3.HierarchyPointLink<TreeNode>, d3.HierarchyPointNode<TreeNode>>()
			.x((d) => d.x + NODE_WIDTH / 2)
			.y((d) => d.y + NODE_HEIGHT / 2);
		return path(link) || '';
	}

	// Get display name for a node
	function getDisplayName(node: TreeNode): string {
		if (node.profile?.name) return node.profile.name;
		if (node.profile?.displayName) return node.profile.displayName;
		return node.event.pubkey.substring(0, 12) + '...';
	}

	// Truncate content
	function truncateContent(content: string): string {
		const cleaned = content.replace(/\n/g, ' ').trim();
		if (cleaned.length <= CONTENT_MAX_LENGTH) return cleaned;
		return cleaned.substring(0, CONTENT_MAX_LENGTH) + '...';
	}

	// Get node styling based on type
	function getNodeClass(node: TreeNode): string {
		if (node.isRoot) return 'fill-primary/10 stroke-primary';
		if (node.isCurrentUser) return 'fill-accent/20 stroke-accent';
		return 'fill-card stroke-border';
	}

	function handleNodeClick(node: TreeNode) {
		onNodeClick?.(node.event);
	}
</script>

<div class="flex flex-col h-full bg-background overflow-hidden">
	<!-- Zoom Controls -->
	<div class="absolute top-14 right-4 z-10 flex flex-col gap-1">
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

	<!-- Main Content Area -->
	<div class="flex-1 overflow-hidden relative" bind:this={containerElement}>
		{#if isLoading}
			<!-- Loading State -->
			<div class="absolute inset-0 flex items-center justify-center">
				<div class="text-center text-muted-foreground">
					<Loader2 class="h-8 w-8 mx-auto mb-2 animate-spin" />
					<p class="text-sm">Loading conversation tree...</p>
				</div>
			</div>
		{:else if !tree || nodes.length === 0}
			<!-- Empty State -->
			<div class="absolute inset-0 flex items-center justify-center">
				<div class="text-center text-muted-foreground">
					<GitFork class="h-12 w-12 mx-auto mb-3 opacity-50" />
					<p class="text-sm font-medium">No conversation tree to display</p>
					<p class="text-xs mt-1">Start a conversation to see the delegation structure</p>
				</div>
			</div>
		{:else}
			<!-- Tree Visualization -->
			<svg
				bind:this={svgElement}
				class="w-full h-full"
				style="cursor: grab;"
				role="tree"
				aria-label="Conversation delegation tree"
			>
				<g {transform}>
					<!-- Links -->
					{#each links as link (link.source.data.id + '-' + link.target.data.id)}
						<path
							class="fill-none stroke-muted-foreground/40"
							stroke-width="2"
							d={linkPath(link)}
						/>
					{/each}

					<!-- Nodes -->
					{#each nodes as node (node.data.id)}
						<g
							transform="translate({node.x}, {node.y})"
							class="cursor-pointer"
							onclick={() => handleNodeClick(node.data)}
							onkeydown={(e) => e.key === 'Enter' && handleNodeClick(node.data)}
							role="treeitem"
							tabindex="0"
							aria-selected="false"
							aria-label="{getDisplayName(node.data)}: {truncateContent(node.data.event.content)}"
						>
							<!-- Node Background -->
							<rect
								width={NODE_WIDTH}
								height={NODE_HEIGHT}
								rx="8"
								class="{getNodeClass(node.data)} transition-colors hover:brightness-95"
								stroke-width={node.data.isRoot ? 2 : 1}
							/>

							<!-- Root Indicator -->
							{#if node.data.isRoot}
								<rect
									x="0"
									y="0"
									width={NODE_WIDTH}
									height="20"
									rx="8"
									class="fill-primary"
								/>
								<rect
									x="0"
									y="12"
									width={NODE_WIDTH}
									height="8"
									class="fill-primary"
								/>
								<text
									x={NODE_WIDTH / 2}
									y="14"
									text-anchor="middle"
									class="text-[10px] fill-primary-foreground font-semibold"
								>
									ROOT
								</text>
							{/if}

							<!-- Author Name -->
							<text
								x="12"
								y={node.data.isRoot ? 38 : 22}
								class="text-xs fill-foreground font-medium"
							>
								{getDisplayName(node.data)}
							</text>

							<!-- Message Content -->
							<foreignObject
								x="12"
								y={node.data.isRoot ? 44 : 28}
								width={NODE_WIDTH - 24}
								height="50"
							>
								<div class="text-xs text-muted-foreground line-clamp-2 overflow-hidden leading-tight">
									{truncateContent(node.data.event.content)}
								</div>
							</foreignObject>

							<!-- User Indicator Badge -->
							{#if node.data.isCurrentUser && !node.data.isRoot}
								<circle
									cx={NODE_WIDTH - 12}
									cy="12"
									r="6"
									class="fill-accent stroke-background"
									stroke-width="2"
								/>
							{/if}
						</g>
					{/each}
				</g>
			</svg>

			<!-- Instructions -->
			<div class="absolute bottom-4 left-4 text-xs text-muted-foreground bg-card/80 px-2 py-1 rounded">
				Scroll to zoom &bull; Drag to pan &bull; Click node to view
			</div>
		{/if}
	</div>
</div>
