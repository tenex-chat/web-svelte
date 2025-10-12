/**
 * Generate a deterministic HSL color based on a string
 * @param str The string to generate color from (agent name or ID)
 * @returns An HSL color string
 */
export function generateAgentColor(str: string): string {
	if (!str) return 'hsl(220, 65%, 55%)';

	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		const char = str.charCodeAt(i);
		hash = (hash << 5) - hash + char;
		hash = hash & hash;
	}

	const hue = Math.abs(hash) % 360;

	return `hsl(${hue}, 65%, 55%)`;
}
