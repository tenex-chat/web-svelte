<script lang="ts">
	import { callSettings, type VADMode, type InterruptionMode, type InterruptionSensitivity } from '$lib/stores/call-settings.svelte';
	import { cn } from '$lib/utils/cn';

	const settings = $derived(callSettings.settings);

	function clearLocalStorage() {
		if (confirm('This will reset your voice call settings. Continue?')) {
			localStorage.removeItem('tenex:call-settings');
			callSettings.reset();
			alert('Settings cleared! Reload the page to apply defaults.');
		}
	}
</script>

<div class="space-y-6">
	<!-- VAD Mode Section -->
	<div class="bg-card border border-border rounded-lg p-6">
		<div class="mb-4">
			<h3 class="text-lg font-semibold text-foreground flex items-center gap-2">
				<span>🎙️</span> Voice Activity Detection
			</h3>
			<p class="text-sm text-muted-foreground mt-1">
				Configure how the system detects when you're speaking
			</p>
		</div>

		<div class="space-y-4">
			<!-- VAD Mode Selection -->
			<div class="space-y-2">
				<p class="text-sm font-medium text-foreground">Detection Mode</p>
				<div class="space-y-2">
					<label class="flex items-start gap-3 p-3 border border-border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors">
						<input
							type="radio"
							name="vad-mode"
							value="auto"
							checked={settings.vadMode === 'auto'}
							onchange={() => callSettings.setVADMode('auto')}
							class="mt-1"
						/>
						<div class="flex-1">
							<span class="text-sm font-medium">Auto-detect (VAD)</span>
							<p class="text-xs text-muted-foreground mt-1">
								Automatically starts recording when you speak. Hands-free operation.
							</p>
						</div>
					</label>

					<label class="flex items-start gap-3 p-3 border border-border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors">
						<input
							type="radio"
							name="vad-mode"
							value="push-to-talk"
							checked={settings.vadMode === 'push-to-talk'}
							onchange={() => callSettings.setVADMode('push-to-talk')}
							class="mt-1"
						/>
						<div class="flex-1">
							<span class="text-sm font-medium">Push-to-talk</span>
							<p class="text-xs text-muted-foreground mt-1">
								Hold the microphone button to speak. More control, prevents accidental recording.
							</p>
						</div>
					</label>

					<label class="flex items-start gap-3 p-3 border border-border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors">
						<input
							type="radio"
							name="vad-mode"
							value="disabled"
							checked={settings.vadMode === 'disabled'}
							onchange={() => callSettings.setVADMode('disabled')}
							class="mt-1"
						/>
						<div class="flex-1">
							<span class="text-sm font-medium">Disabled</span>
							<p class="text-xs text-muted-foreground mt-1">
								Manual control only. Click to start/stop recording.
							</p>
						</div>
					</label>
				</div>
			</div>

			<!-- VAD Sensitivity (only show when VAD is enabled) -->
			{#if settings.vadMode === 'auto'}
				<div class="space-y-2 pl-4 pt-2">
					<label for="vad-sensitivity" class="block text-sm font-medium text-foreground">
						Sensitivity: {settings.vadSensitivity}
					</label>
					<input
						id="vad-sensitivity"
						type="range"
						min="0"
						max="100"
						step="1"
						value={settings.vadSensitivity}
						oninput={(e) => callSettings.setVADSensitivity(parseInt(e.currentTarget.value))}
						class="w-full"
					/>
					<div class="flex justify-between text-xs text-muted-foreground">
						<span>More sensitive (picks up quieter sounds)</span>
						<span>Less sensitive (only loud speech)</span>
					</div>
				</div>
			{/if}
		</div>
	</div>

	<!-- Audio Processing Section -->
	<div class="bg-card border border-border rounded-lg p-6">
		<div class="mb-4">
			<h3 class="text-lg font-semibold text-foreground flex items-center gap-2">
				<span>🔊</span> Audio Processing
			</h3>
			<p class="text-sm text-muted-foreground mt-1">
				Configure audio enhancements and filters
			</p>
		</div>

		<div class="space-y-4">
			<!-- Input Volume -->
			<div class="space-y-2">
				<label for="input-volume" class="block text-sm font-medium text-foreground">
					Input Volume: {settings.inputVolume}%
				</label>
				<input
					id="input-volume"
					type="range"
					min="0"
					max="100"
					step="1"
					value={settings.inputVolume}
					oninput={(e) => callSettings.setInputVolume(parseInt(e.currentTarget.value))}
					class="w-full"
				/>
			</div>

			<!-- Noise Suppression -->
			<div class="flex items-center justify-between">
				<div>
					<label for="noise-suppression" class="text-sm font-medium text-foreground">
						Noise Suppression
					</label>
					<p class="text-xs text-muted-foreground">Reduce background noise</p>
				</div>
				<input
					id="noise-suppression"
					type="checkbox"
					checked={settings.noiseSuppression}
					onchange={callSettings.toggleNoiseSuppression.bind(callSettings)}
					class="w-4 h-4"
				/>
			</div>

			<!-- Echo Cancellation -->
			<div class="flex items-center justify-between">
				<div>
					<label for="echo-cancellation" class="text-sm font-medium text-foreground">
						Echo Cancellation
					</label>
					<p class="text-xs text-muted-foreground">Prevent audio feedback</p>
				</div>
				<input
					id="echo-cancellation"
					type="checkbox"
					checked={settings.echoCancellation}
					onchange={callSettings.toggleEchoCancellation.bind(callSettings)}
					class="w-4 h-4"
				/>
			</div>

			<!-- Voice Activity Detection (processing) -->
			<div class="flex items-center justify-between">
				<div>
					<label for="voice-activity" class="text-sm font-medium text-foreground">
						Voice Activity Detection (Audio Processing)
					</label>
					<p class="text-xs text-muted-foreground">Enable VAD in audio pipeline</p>
				</div>
				<input
					id="voice-activity"
					type="checkbox"
					checked={settings.voiceActivityDetection}
					onchange={callSettings.toggleVoiceActivityDetection.bind(callSettings)}
					class="w-4 h-4"
				/>
			</div>
		</div>
	</div>

	<!-- Interruption Settings -->
	<div class="bg-card border border-border rounded-lg p-6">
		<div class="mb-4">
			<h3 class="text-lg font-semibold text-foreground flex items-center gap-2">
				<span>⚡</span> Interruption Settings
			</h3>
			<p class="text-sm text-muted-foreground mt-1">
				Control when you can interrupt the AI during responses
			</p>
		</div>

		<div class="space-y-4">
			<!-- Interruption Mode -->
			<div class="space-y-2">
				<p class="text-sm font-medium text-foreground">Interruption Mode</p>
				<div class="space-y-2">
					<label class="flex items-start gap-3 p-3 border border-border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors">
						<input
							type="radio"
							name="interrupt-mode"
							value="disabled"
							checked={settings.interruptionMode === 'disabled'}
							onchange={() => callSettings.setInterruptionMode('disabled')}
							class="mt-1"
						/>
						<div class="flex-1">
							<span class="text-sm font-medium">Disabled</span>
							<p class="text-xs text-muted-foreground mt-1">
								Cannot interrupt AI while speaking
							</p>
						</div>
					</label>

					<label class="flex items-start gap-3 p-3 border border-border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors">
						<input
							type="radio"
							name="interrupt-mode"
							value="headphones"
							checked={settings.interruptionMode === 'headphones'}
							onchange={() => callSettings.setInterruptionMode('headphones')}
							class="mt-1"
						/>
						<div class="flex-1">
							<span class="text-sm font-medium">Headphones Mode</span>
							<p class="text-xs text-muted-foreground mt-1">
								Can interrupt when using headphones
							</p>
						</div>
					</label>
				</div>
			</div>

			<!-- Interruption Sensitivity (only show when enabled) -->
			{#if settings.interruptionMode === 'headphones'}
				<div class="space-y-2 pl-4">
					<p class="text-sm font-medium text-foreground">Interruption Sensitivity</p>
					<div class="space-y-2">
						{#each ['low', 'medium', 'high'] as sensitivity}
							<label class="flex items-center gap-2">
								<input
									type="radio"
									name="interrupt-sensitivity"
									value={sensitivity}
									checked={settings.interruptionSensitivity === sensitivity}
									onchange={() => callSettings.setInterruptionSensitivity(sensitivity as InterruptionSensitivity)}
								/>
								<span class="text-sm capitalize">{sensitivity}</span>
							</label>
						{/each}
					</div>
				</div>
			{/if}
		</div>
	</div>

	<!-- Device Selection (placeholder - could be enhanced) -->
	<div class="bg-card border border-border rounded-lg p-6">
		<div class="mb-4">
			<h3 class="text-lg font-semibold text-foreground flex items-center gap-2">
				<span>🎧</span> Audio Devices
			</h3>
			<p class="text-sm text-muted-foreground mt-1">
				Select input and output devices (configured through browser permissions)
			</p>
		</div>

		<div class="space-y-4">
			<div class="space-y-2">
				<label class="block text-sm font-medium text-foreground">
					Input Device
				</label>
				<p class="text-xs text-muted-foreground">
					{settings.inputDeviceId || 'Default microphone'}
				</p>
			</div>

			<div class="space-y-2">
				<label class="block text-sm font-medium text-foreground">
					Output Device
				</label>
				<p class="text-xs text-muted-foreground">
					{settings.outputDeviceId || 'Default speaker'}
				</p>
			</div>
		</div>
	</div>

	<!-- Quick Actions -->
	<div class="bg-card border border-border rounded-lg p-6">
		<div class="mb-4">
			<h3 class="text-lg font-semibold text-foreground flex items-center gap-2">
				<span>⚙️</span> Quick Actions
			</h3>
		</div>
		<div class="flex gap-2">
			<button
				onclick={callSettings.reset.bind(callSettings)}
				class="px-4 py-2 border border-border rounded hover:bg-muted transition-colors"
			>
				Reset to Defaults
			</button>
			<button
				onclick={clearLocalStorage}
				class="px-4 py-2 border border-border rounded hover:bg-muted transition-colors"
			>
				Clear Stored Settings
			</button>
		</div>
	</div>
</div>
