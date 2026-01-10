<script lang="ts">
	import { ndk } from '$lib/ndk.svelte';
	import NDKBlossom from '@nostr-dev-kit/blossom';
	import { Camera, X, Upload, User } from 'lucide-svelte';

	interface Props {
		/** Current avatar URL */
		avatarUrl?: string | null;
		/** Size of the avatar in pixels */
		size?: number;
		/** Callback when avatar is uploaded or removed */
		onAvatarChange: (url: string | null) => void;
		/** Placeholder text when no avatar */
		placeholder?: string;
		/** Whether to show a rounded square or circle */
		shape?: 'circle' | 'square';
		/** Custom class */
		class?: string;
	}

	let {
		avatarUrl = null,
		size = 96,
		onAvatarChange,
		placeholder = '',
		shape = 'circle',
		class: className = ''
	}: Props = $props();

	let isUploading = $state(false);
	let uploadProgress = $state(0);
	let fileInputRef = $state<HTMLInputElement | null>(null);
	let showMenu = $state(false);

	// Proxy the image URL for display
	const proxiedUrl = $derived(
		avatarUrl ? `/api/proxy?url=${encodeURIComponent(avatarUrl)}` : null
	);

	// Get initials from placeholder
	const initials = $derived(placeholder ? placeholder.slice(0, 2).toUpperCase() : '');

	async function handleFileSelect(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];

		if (!file || !ndk || !ndk.$currentUser) {
			return;
		}

		// Only accept image files
		if (!file.type.startsWith('image/')) {
			console.error('Only image files are supported');
			return;
		}

		// Check file size (max 5MB for avatars)
		const maxSize = 5 * 1024 * 1024;
		if (file.size > maxSize) {
			alert('Avatar image must be smaller than 5MB');
			return;
		}

		isUploading = true;
		uploadProgress = 0;

		try {
			const blossom = new NDKBlossom(ndk);

			// Track upload progress
			blossom.onUploadProgress = (progress) => {
				const progressPercent = Math.round((progress.loaded / progress.total) * 100);
				uploadProgress = progressPercent;
				return 'continue';
			};

			// Handle upload errors
			blossom.onUploadFailed = (error, serverUrl) => {
				console.error('Upload failed:', error, 'on server:', serverUrl);
			};

			// Upload to blossom.primal.net by default
			const imeta = await blossom.upload(file, {
				server: 'https://blossom.primal.net'
			});

			if (imeta.url) {
				onAvatarChange(imeta.url);
			}
		} catch (error) {
			console.error('Failed to upload avatar:', error);
			alert('Failed to upload avatar. Please try again.');
		} finally {
			isUploading = false;
			uploadProgress = 0;
			showMenu = false;
			// Reset file input
			if (input) {
				input.value = '';
			}
		}
	}

	function handleRemove() {
		onAvatarChange(null);
		showMenu = false;
	}

	function triggerUpload() {
		fileInputRef?.click();
	}
</script>

<div class="relative inline-block {className}">
	<!-- Hidden file input -->
	<input
		bind:this={fileInputRef}
		type="file"
		accept="image/*"
		onchange={handleFileSelect}
		class="hidden"
	/>

	<!-- Avatar Display -->
	<button
		type="button"
		onclick={() => (showMenu = !showMenu)}
		class="relative group focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 {shape === 'circle' ? 'rounded-full' : 'rounded-lg'}"
		style="width: {size}px; height: {size}px;"
		disabled={isUploading}
	>
		<!-- Avatar Image or Placeholder -->
		<div
			class="w-full h-full flex items-center justify-center bg-muted text-muted-foreground font-semibold overflow-hidden border-2 border-border {shape === 'circle' ? 'rounded-full' : 'rounded-lg'}"
			style="font-size: {size * 0.35}px;"
		>
			{#if isUploading}
				<!-- Upload Progress -->
				<div class="absolute inset-0 flex flex-col items-center justify-center bg-muted {shape === 'circle' ? 'rounded-full' : 'rounded-lg'}">
					<div class="relative" style="width: {size * 0.5}px; height: {size * 0.5}px;">
						<svg class="w-full h-full -rotate-90" viewBox="0 0 36 36">
							<circle
								cx="18"
								cy="18"
								r="15"
								fill="none"
								stroke="currentColor"
								stroke-width="3"
								class="text-muted-foreground/20"
							/>
							<circle
								cx="18"
								cy="18"
								r="15"
								fill="none"
								stroke="currentColor"
								stroke-width="3"
								class="text-primary"
								stroke-dasharray="94.25"
								stroke-dashoffset={94.25 * (1 - uploadProgress / 100)}
								stroke-linecap="round"
							/>
						</svg>
						<span class="absolute inset-0 flex items-center justify-center text-xs font-medium">
							{uploadProgress}%
						</span>
					</div>
				</div>
			{:else if proxiedUrl}
				<img
					src={proxiedUrl}
					alt="Avatar"
					class="w-full h-full object-cover"
					crossorigin="anonymous"
				/>
			{:else if initials}
				{initials}
			{:else}
				<User class="w-1/2 h-1/2" />
			{/if}
		</div>

		<!-- Hover Overlay -->
		{#if !isUploading}
			<div
				class="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity {shape === 'circle' ? 'rounded-full' : 'rounded-lg'}"
			>
				<Camera class="w-1/3 h-1/3 text-white" />
			</div>
		{/if}
	</button>

	<!-- Action Menu -->
	{#if showMenu && !isUploading}
		<div
			class="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-card border border-border rounded-lg shadow-lg overflow-hidden z-50 min-w-[140px]"
		>
			<button
				type="button"
				onclick={triggerUpload}
				class="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent transition-colors text-left"
			>
				<Upload class="w-4 h-4" />
				{avatarUrl ? 'Change Avatar' : 'Upload Avatar'}
			</button>
			{#if avatarUrl}
				<button
					type="button"
					onclick={handleRemove}
					class="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-destructive/10 text-destructive transition-colors text-left"
				>
					<X class="w-4 h-4" />
					Remove Avatar
				</button>
			{/if}
		</div>
	{/if}
</div>

<!-- Click outside to close menu -->
{#if showMenu}
	<button
		type="button"
		class="fixed inset-0 z-40"
		onclick={() => (showMenu = false)}
		aria-label="Close menu"
	></button>
{/if}
