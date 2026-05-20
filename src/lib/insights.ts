import type { Encounter } from './stores';
import { getAttitudeInfo } from './attitude';

// ──────────────────────────────────────────
// Weekly Insights
// ──────────────────────────────────────────

export interface WeeklyInsight {
	totalMeetsThisWeek: number;
	newDogsThisWeek: number;
	returningDogsThisWeek: string[];
	avgFriendlinessThisWeek: number;
	avgFriendlinessAllTime: number;
	friendlinessChange: number; // positive = improving
	mostActiveDay: string;
	activeDaysThisWeek: number;
	topDog: { name: string; meets: number } | null;
	friendlyPercentThisWeek: number; // % of meets that are 4+
	headline: string;
	encouragement: string;
}

const DAY_MS = 86400000;

function getWeekStart(): Date {
	const now = new Date();
	const dayOfWeek = now.getDay(); // 0=Sun
	const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Monday-based
	const start = new Date(now);
	start.setHours(0, 0, 0, 0);
	start.setDate(start.getDate() - diff);
	return start;
}

export function computeWeeklyInsights(encounters: Encounter[]): WeeklyInsight {
	const weekStart = getWeekStart();
	const now = new Date();

	const thisWeek = encounters.filter(e => e.timestamp >= weekStart);
	const beforeThisWeek = encounters.filter(e => e.timestamp < weekStart);

	// Dogs seen before this week
	const dogsBefore = new Set(beforeThisWeek.map(e => e.dogName.toLowerCase().trim()));

	// New vs returning
	const dogsThisWeek = new Map<string, number>();
	for (const enc of thisWeek) {
		const key = enc.dogName.toLowerCase().trim();
		dogsThisWeek.set(key, (dogsThisWeek.get(key) || 0) + 1);
	}

	const newDogsThisWeek = [...dogsThisWeek.keys()].filter(d => !dogsBefore.has(d)).length;
	const returningDogsThisWeek = [...dogsThisWeek.keys()]
		.filter(d => dogsBefore.has(d))
		.map(d => {
			// Find original casing
			const enc = thisWeek.find(e => e.dogName.toLowerCase().trim() === d);
			return enc?.dogName || d;
		});

	// Avg friendliness
	const avgThisWeek = thisWeek.length > 0
		? thisWeek.reduce((s, e) => s + e.friendliness, 0) / thisWeek.length
		: 0;
	const avgAllTime = encounters.length > 0
		? encounters.reduce((s, e) => s + e.friendliness, 0) / encounters.length
		: 0;

	// Friendly percentage (4+ out of 5)
	const friendlyMeets = thisWeek.filter(e => e.friendliness >= 4).length;
	const friendlyPercent = thisWeek.length > 0
		? Math.round((friendlyMeets / thisWeek.length) * 100)
		: 0;

	// Active days this week
	const activeDays = new Set(
		thisWeek.map(e => e.timestamp.toLocaleDateString())
	);

	// Most active day
	const dayCount = new Map<string, number>();
	for (const enc of thisWeek) {
		const day = enc.timestamp.toLocaleDateString('en-US', { weekday: 'long' });
		dayCount.set(day, (dayCount.get(day) || 0) + 1);
	}
	let mostActiveDay = '—';
	let maxCount = 0;
	for (const [day, count] of dayCount) {
		if (count > maxCount) {
			mostActiveDay = day;
			maxCount = count;
		}
	}

	// Top recurring dog (most meets all time)
	const allDogCounts = new Map<string, { name: string; count: number }>();
	for (const enc of encounters) {
		const key = enc.dogName.toLowerCase().trim();
		const existing = allDogCounts.get(key);
		if (existing) {
			existing.count++;
		} else {
			allDogCounts.set(key, { name: enc.dogName, count: 1 });
		}
	}
	let topDog: { name: string; meets: number } | null = null;
	let topCount = 0;
	for (const [, val] of allDogCounts) {
		if (val.count > topCount) {
			topCount = val.count;
			topDog = { name: val.name, meets: val.count };
		}
	}

	// Friendliness trend vs previous weeks
	const prevWeekStart = new Date(weekStart.getTime() - 7 * DAY_MS);
	const prevWeek = encounters.filter(e => e.timestamp >= prevWeekStart && e.timestamp < weekStart);
	const avgPrevWeek = prevWeek.length > 0
		? prevWeek.reduce((s, e) => s + e.friendliness, 0) / prevWeek.length
		: avgAllTime;
	const friendlinessChange = avgThisWeek - avgPrevWeek;

	// Generate headline
	const headline = generateHeadline(thisWeek.length, newDogsThisWeek, returningDogsThisWeek, friendlyPercent, topDog);
	const encouragement = generateEncouragement(encounters.length, activeDays.size, avgAllTime, topDog);

	return {
		totalMeetsThisWeek: thisWeek.length,
		newDogsThisWeek,
		returningDogsThisWeek,
		avgFriendlinessThisWeek: Number(avgThisWeek.toFixed(1)),
		avgFriendlinessAllTime: Number(avgAllTime.toFixed(1)),
		friendlinessChange: Number(friendlinessChange.toFixed(1)),
		mostActiveDay,
		activeDaysThisWeek: activeDays.size,
		topDog,
		friendlyPercentThisWeek: friendlyPercent,
		headline,
		encouragement
	};
}

function generateHeadline(
	meetsThisWeek: number,
	newDogs: number,
	returningDogs: string[],
	friendlyPercent: number,
	topDog: { name: string; meets: number } | null
): string {
	if (meetsThisWeek === 0) {
		return "Time for a walk? Your furry friends are waiting! 🐕";
	}
	if (newDogs >= 3) {
		return `${newDogs} new dogs discovered this week — you're exploring! 🌟`;
	}
	if (returningDogs.length >= 2) {
		return `You bumped into ${returningDogs.length} familiar pups again! 🐾`;
	}
	if (friendlyPercent >= 80) {
		return `${friendlyPercent}% friendly vibes this week — amazing! ✨`;
	}
	if (topDog && topDog.meets >= 3) {
		return `${topDog.name} is becoming your regular walking buddy! 🤝`;
	}
	if (meetsThisWeek >= 5) {
		return `${meetsThisWeek} meets this week — you're on a roll! 🔥`;
	}
	if (newDogs >= 1) {
		return `You met ${newDogs} new dog${newDogs > 1 ? 's' : ''} this week! 🎉`;
	}
	return `${meetsThisWeek} encounter${meetsThisWeek > 1 ? 's' : ''} logged — keep it up! 💪`;
}

function generateEncouragement(
	totalEncounters: number,
	activeDaysThisWeek: number,
	avgFriendliness: number,
	topDog: { name: string; meets: number } | null
): string {
	if (totalEncounters >= 50) {
		return "You're building an incredible database of your neighborhood's dog community!";
	}
	if (avgFriendliness >= 4.0) {
		return "Your walks attract positive energy — most dogs you meet are friendly!";
	}
	if (topDog && topDog.meets >= 3) {
		return `You and ${topDog.name} clearly have a bond. The more you log, the better predictions get.`;
	}
	if (activeDaysThisWeek >= 5) {
		return "Consistent logging = better predictions. You're building something valuable!";
	}
	if (totalEncounters >= 10) {
		return "Every encounter you log makes your predictions smarter. Keep going!";
	}
	return "The first few weeks are the most important — each log teaches the app about your routine.";
}

// ──────────────────────────────────────────
// Milestones / Achievements
// ──────────────────────────────────────────

export interface Milestone {
	id: string;
	icon: string;
	title: string;
	description: string;
	unlocked: boolean;
	progress: number;  // 0-1
	target: number;
	current: number;
}

export function computeMilestones(encounters: Encounter[]): Milestone[] {
	const uniqueDogs = new Set(encounters.map(e => e.dogName.toLowerCase().trim()));

	// Dog counts for recurring meets
	const dogCounts = new Map<string, number>();
	for (const enc of encounters) {
		const key = enc.dogName.toLowerCase().trim();
		dogCounts.set(key, (dogCounts.get(key) || 0) + 1);
	}
	const recurringDogs = [...dogCounts.values()].filter(c => c >= 3).length;

	// Active days
	const activeDays = new Set(encounters.map(e => e.timestamp.toLocaleDateString()));

	// Avg friendliness
	const avgFriendliness = encounters.length > 0
		? encounters.reduce((s, e) => s + e.friendliness, 0) / encounters.length
		: 0;

	// Friendly meets
	const friendlyMeets = encounters.filter(e => e.friendliness >= 4).length;

	// Streak calculation (consecutive days)
	const sortedDays = [...activeDays].map(d => new Date(d).getTime()).sort((a, b) => b - a);
	let streak = 0;
	if (sortedDays.length > 0) {
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		const todayMs = today.getTime();
		// Check if most recent day is today or yesterday
		if (sortedDays[0] >= todayMs - DAY_MS) {
			streak = 1;
			for (let i = 1; i < sortedDays.length; i++) {
				if (sortedDays[i - 1] - sortedDays[i] <= DAY_MS + 1000) {
					streak++;
				} else {
					break;
				}
			}
		}
	}

	return [
		{
			id: 'first_meet',
			icon: '🐾',
			title: 'First Encounter',
			description: 'Log your first dog meet',
			unlocked: encounters.length >= 1,
			progress: Math.min(1, encounters.length / 1),
			target: 1,
			current: Math.min(1, encounters.length)
		},
		{
			id: 'social_5',
			icon: '🐕',
			title: 'Social Walker',
			description: 'Meet 5 different dogs',
			unlocked: uniqueDogs.size >= 5,
			progress: Math.min(1, uniqueDogs.size / 5),
			target: 5,
			current: Math.min(5, uniqueDogs.size)
		},
		{
			id: 'pack_leader',
			icon: '👑',
			title: 'Pack Leader',
			description: 'Log 15 encounters',
			unlocked: encounters.length >= 15,
			progress: Math.min(1, encounters.length / 15),
			target: 15,
			current: Math.min(15, encounters.length)
		},
		{
			id: 'good_vibes',
			icon: '🥰',
			title: 'Good Vibes',
			description: 'Maintain avg friendliness ≥ 4.0',
			unlocked: encounters.length >= 3 && avgFriendliness >= 4.0,
			progress: encounters.length >= 3 ? Math.min(1, avgFriendliness / 4.0) : 0,
			target: 4,
			current: encounters.length >= 3 ? Number(avgFriendliness.toFixed(1)) : 0
		},
		{
			id: 'best_friends',
			icon: '🤝',
			title: 'Best Friends',
			description: 'Meet the same dog 3+ times',
			unlocked: recurringDogs >= 1,
			progress: Math.min(1, Math.max(...dogCounts.values(), 0) / 3),
			target: 3,
			current: Math.min(3, Math.max(...dogCounts.values(), 0))
		},
		{
			id: 'explorer',
			icon: '🗺️',
			title: 'Explorer',
			description: 'Meet 10 unique dogs',
			unlocked: uniqueDogs.size >= 10,
			progress: Math.min(1, uniqueDogs.size / 10),
			target: 10,
			current: Math.min(10, uniqueDogs.size)
		},
		{
			id: 'streak_3',
			icon: '🔥',
			title: '3-Day Streak',
			description: 'Log encounters 3 days in a row',
			unlocked: streak >= 3,
			progress: Math.min(1, streak / 3),
			target: 3,
			current: Math.min(3, streak)
		},
		{
			id: 'friendly_10',
			icon: '✨',
			title: 'Friendship Magnet',
			description: '10 friendly or very friendly meets',
			unlocked: friendlyMeets >= 10,
			progress: Math.min(1, friendlyMeets / 10),
			target: 10,
			current: Math.min(10, friendlyMeets)
		},
		{
			id: 'veteran',
			icon: '🏆',
			title: 'Veteran Walker',
			description: 'Log 50 encounters total',
			unlocked: encounters.length >= 50,
			progress: Math.min(1, encounters.length / 50),
			target: 50,
			current: Math.min(50, encounters.length)
		}
	];
}
