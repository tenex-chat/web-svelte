<script lang="ts">
	import { generateColorFromString } from '$lib/utils/colors';

	interface Props {
		branch: string;
		class?: string;
	}

	let { branch, class: className }: Props = $props();

	const branchColor = $derived(generateColorFromString(branch));
</script>

<span
	class="branch-badge {className || ''}"
	style="background-color: {branchColor.replace(')', ', 0.15)')}; color: {branchColor}; border-color: {branchColor.replace(')', ', 0.3)')}"
	title="Git branch: {branch}"
>
	{branch}
</span>

<style>
	.branch-badge {
		font-size: 9px;
		padding: 2px 8px;
		border-radius: 10px;
		font-weight: 500;
		white-space: nowrap;
		border: 1px solid;
		font-family: monospace;
	}
</style>
