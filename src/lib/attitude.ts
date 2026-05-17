export function getAttitudeInfo(score: number) {
	const val = Math.round(score);
	if (val <= 1) return { text: 'Very Unfriendly', emoji: '😡', colorClass: 'text-error' };
	if (val === 2) return { text: 'Unfriendly', emoji: '😒', colorClass: 'text-warning' };
	if (val === 3) return { text: 'Neutral', emoji: '🫥', colorClass: 'text-base-content/70' };
	if (val === 4) return { text: 'Friendly', emoji: '🙂', colorClass: 'text-info' };
	return { text: 'Very Friendly', emoji: '🥰', colorClass: 'text-success' };
}
