/**
 * Generate a deterministic HSL color based on a string
 * @param str The string to generate color from
 * @param saturation HSL saturation percentage (default: 65)
 * @param lightness HSL lightness percentage (default: 55)
 * @returns An HSL color string
 */
export function generateColorFromString(
	str: string,
	saturation: number = 65,
	lightness: number = 55
): string {
	if (!str) return `hsl(220, ${saturation}%, ${lightness}%)`;

	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		const char = str.charCodeAt(i);
		hash = (hash << 5) - hash + char;
		hash = hash & hash;
	}

	const hue = Math.abs(hash) % 360;

	return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

/**
 * Generate a deterministic HSL color based on a string (agent-specific alias)
 * @deprecated Use generateColorFromString instead
 * @param str The string to generate color from (agent name or ID)
 * @returns An HSL color string
 */
export function generateAgentColor(str: string): string {
	return generateColorFromString(str);
}
