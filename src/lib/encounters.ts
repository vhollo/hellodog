import {
	collection,
	addDoc,
	getDocs,
	query,
	orderBy,
	where,
	serverTimestamp,
	Timestamp,
	limit,
	updateDoc,
	getDoc,
	deleteDoc,
	doc
} from 'firebase/firestore';
import { getFirebaseDb } from './firebase';
import { encounters, type Encounter, predictions, type Prediction, userProfile } from './stores';
import { get } from 'svelte/store';

// ──────────────────────────────────────────
// Encounters CRUD
// ──────────────────────────────────────────

export async function addEncounter(uid: string, encounter: Omit<Encounter, 'id'>): Promise<string> {
	const db = getFirebaseDb();
	
	let resolvedMetUserId = encounter.metUserId;
	if (!resolvedMetUserId && encounter.dogName) {
		// Try to match the entered dog name to a registered user
		const usersRef = collection(db, 'users');
		const qUser = query(usersRef, where('dogName', '==', encounter.dogName.trim()), limit(1));
		const snap = await getDocs(qUser);
		if (!snap.empty) {
			resolvedMetUserId = snap.docs[0].id;
		}
	}
	
	// Write to user's encounters subcollection
	const userEncRef = collection(db, 'users', uid, 'encounters');
	const docRef = await addDoc(userEncRef, {
		dogName: encounter.dogName,
		friendliness: encounter.friendliness,
		notes: encounter.notes || '',
		location: encounter.location,
		timestamp: Timestamp.fromDate(encounter.timestamp),
		metUserId: resolvedMetUserId || null
	});

	// Also write to global encounters collection (for paid-tier cross-referencing)
	const globalRef = collection(db, 'encounters_global');
	await addDoc(globalRef, {
		dogName: encounter.dogName,
		friendliness: encounter.friendliness,
		notes: encounter.notes || '',
		location: encounter.location,
		timestamp: Timestamp.fromDate(encounter.timestamp),
		metUserId: resolvedMetUserId || null,
		reportedByUid: uid
	});

	return docRef.id;
}

export async function updateEncounter(uid: string, encounterId: string, updates: Partial<Encounter>): Promise<void> {
	const db = getFirebaseDb();
	const docRef = doc(db, 'users', uid, 'encounters', encounterId);
	
	const docSnap = await getDoc(docRef);
	if (!docSnap.exists()) return;
	const originalData = docSnap.data();
	const oldDogName = originalData.dogName;
	const originalTimestamp = originalData.timestamp;
	
	const newName = updates.dogName?.trim();
	const nameChanged = newName && oldDogName && newName !== oldDogName.trim();
	
	let resolvedMetUserId = updates.metUserId;
	if (updates.dogName !== undefined) {
		// Try to match the edited dog name to a registered user
		const usersRef = collection(db, 'users');
		const qUser = query(usersRef, where('dogName', '==', updates.dogName.trim()), limit(1));
		const snap = await getDocs(qUser);
		if (!snap.empty) {
			resolvedMetUserId = snap.docs[0].id;
		} else {
			resolvedMetUserId = null;
		}
	}
	
	const dataToUpdate: any = {};
	if (updates.dogName !== undefined) {
		dataToUpdate.dogName = newName;
		dataToUpdate.metUserId = resolvedMetUserId;
	}
	if (updates.friendliness !== undefined) dataToUpdate.friendliness = updates.friendliness;
	if (updates.notes !== undefined) dataToUpdate.notes = updates.notes;
	if (updates.location !== undefined) dataToUpdate.location = updates.location;
	if (updates.timestamp !== undefined) dataToUpdate.timestamp = Timestamp.fromDate(updates.timestamp);
	
	if (nameChanged) {
		// Update all local encounters for this user with the same old name
		const userEncRef = collection(db, 'users', uid, 'encounters');
		const qUserEnc = query(userEncRef, where('dogName', '==', oldDogName.trim()));
		const userEncSnap = await getDocs(qUserEnc);
		
		const promises = userEncSnap.docs.map(docSnap => {
			if (docSnap.id === encounterId) {
				return updateDoc(docSnap.ref, dataToUpdate);
			} else {
				return updateDoc(docSnap.ref, {
					dogName: newName,
					metUserId: resolvedMetUserId
				});
			}
		});
		await Promise.all(promises);

		// Update corresponding global encounters reported by this user with the same old name
		const globalRef = collection(db, 'encounters_global');
		const qGlobal = query(globalRef, where('reportedByUid', '==', uid), where('dogName', '==', oldDogName.trim()));
		const globalSnap = await getDocs(qGlobal);
		
		const globalPromises = globalSnap.docs.map(docSnap => {
			const d = docSnap.data();
			const isSpecificMeet = originalTimestamp && d.timestamp && d.timestamp.toMillis() === originalTimestamp.toMillis();
			if (isSpecificMeet) {
				const globalUpdate: any = {
					dogName: newName,
					metUserId: resolvedMetUserId
				};
				if (updates.friendliness !== undefined) globalUpdate.friendliness = updates.friendliness;
				if (updates.notes !== undefined) globalUpdate.notes = updates.notes;
				if (updates.location !== undefined) globalUpdate.location = updates.location;
				if (updates.timestamp !== undefined) globalUpdate.timestamp = Timestamp.fromDate(updates.timestamp);
				return updateDoc(docSnap.ref, globalUpdate);
			} else {
				return updateDoc(docSnap.ref, {
					dogName: newName,
					metUserId: resolvedMetUserId
				});
			}
		});
		await Promise.all(globalPromises);
	} else {
		// Just update the single local encounter
		await updateDoc(docRef, dataToUpdate);

		// If name didn't change, still update the corresponding global doc if other fields changed
		if (originalTimestamp) {
			const globalRef = collection(db, 'encounters_global');
			const qGlobal = query(globalRef, where('reportedByUid', '==', uid), where('dogName', '==', oldDogName.trim()));
			const globalSnap = await getDocs(qGlobal);
			
			const globalPromises = globalSnap.docs.map(docSnap => {
				const d = docSnap.data();
				const isSpecificMeet = d.timestamp && d.timestamp.toMillis() === originalTimestamp.toMillis();
				if (isSpecificMeet) {
					const globalUpdate: any = {};
					if (updates.friendliness !== undefined) globalUpdate.friendliness = updates.friendliness;
					if (updates.notes !== undefined) globalUpdate.notes = updates.notes;
					if (updates.location !== undefined) globalUpdate.location = updates.location;
					if (updates.timestamp !== undefined) globalUpdate.timestamp = Timestamp.fromDate(updates.timestamp);
					return updateDoc(docSnap.ref, globalUpdate);
				}
				return Promise.resolve();
			});
			await Promise.all(globalPromises);
		}
	}
}

export async function deleteEncounter(uid: string, encounterId: string): Promise<void> {
	const db = getFirebaseDb();
	const docRef = doc(db, 'users', uid, 'encounters', encounterId);

	// Read first so we can find and remove the denormalized global twin.
	const docSnap = await getDoc(docRef);
	const data = docSnap.exists() ? docSnap.data() : null;

	await deleteDoc(docRef);

	// Remove the matching global doc (same reporter, dog name, and timestamp).
	if (data?.dogName && data?.timestamp) {
		const globalRef = collection(db, 'encounters_global');
		const qGlobal = query(
			globalRef,
			where('reportedByUid', '==', uid),
			where('dogName', '==', data.dogName)
		);
		const globalSnap = await getDocs(qGlobal);
		const deletions = globalSnap.docs
			.filter((d) => d.data().timestamp?.toMillis?.() === data.timestamp.toMillis())
			.map((d) => deleteDoc(d.ref));
		await Promise.all(deletions);
	}

	// Optimistically drop it from the local store.
	encounters.update((list) => list.filter((e) => e.id !== encounterId));
}

export async function loadEncounters(uid: string): Promise<void> {
	const db = getFirebaseDb();
	const encRef = collection(db, 'users', uid, 'encounters');
	const q = query(encRef, orderBy('timestamp', 'desc'), limit(200));
	const snap = await getDocs(q);

	const data: Encounter[] = snap.docs.map((doc) => {
		const d = doc.data();
		return {
			id: doc.id,
			dogName: d.dogName,
			friendliness: d.friendliness,
			notes: d.notes,
			location: d.location,
			timestamp: d.timestamp?.toDate() || new Date(),
			metUserId: d.metUserId
		};
	});

	encounters.set(data);
}

// ──────────────────────────────────────────
// Prediction Engine
// ──────────────────────────────────────────

function clusterLocations(encounters: Encounter[]): Map<string, Encounter[]> {
	// Simple grid-based clustering (~100m cells)
	const grid = new Map<string, Encounter[]>();
	for (const enc of encounters) {
		const key = `${Math.round(enc.location.lat * 1000)},${Math.round(enc.location.lng * 1000)}`;
		if (!grid.has(key)) grid.set(key, []);
		grid.get(key)!.push(enc);
	}
	return grid;
}

function getHourBucket(date: Date): string {
	const h = date.getHours();
	if (h < 6) return 'early-morning';
	if (h < 9) return 'morning';
	if (h < 12) return 'late-morning';
	if (h < 14) return 'midday';
	if (h < 17) return 'afternoon';
	if (h < 20) return 'evening';
	return 'night';
}

function formatHourRange(bucket: string): string {
	const ranges: Record<string, string> = {
		'early-morning': '05:00–06:00',
		'morning': '07:00–09:00',
		'late-morning': '09:00–12:00',
		'midday': '12:00–14:00',
		'afternoon': '14:00–17:00',
		'evening': '17:00–20:00',
		'night': '20:00–23:00'
	};
	return ranges[bucket] || bucket;
}

export function generatePredictions(userEncounters: Encounter[], globalEncounters?: Encounter[]): Prediction[] {
	const isPaid = get(userProfile)?.isPaid || false;
	const allEncounters = isPaid && globalEncounters
		? [...userEncounters, ...globalEncounters]
		: userEncounters;

	// Group by dog name
	const byDog = new Map<string, Encounter[]>();
	for (const enc of allEncounters) {
		const name = enc.dogName.toLowerCase().trim();
		if (!byDog.has(name)) byDog.set(name, []);
		byDog.get(name)!.push(enc);
	}

	const preds: Prediction[] = [];

	for (const [dogName, encs] of byDog) {
		if (encs.length < 1) continue;

		// Average friendliness
		const avgFriendliness = encs.reduce((sum, e) => sum + e.friendliness, 0) / encs.length;

		// Most common time bucket
		const timeBuckets = new Map<string, number>();
		for (const e of encs) {
			const bucket = getHourBucket(e.timestamp);
			timeBuckets.set(bucket, (timeBuckets.get(bucket) || 0) + 1);
		}
		let bestBucket = 'morning';
		let bestCount = 0;
		for (const [bucket, count] of timeBuckets) {
			if (count > bestCount) {
				bestBucket = bucket;
				bestCount = count;
			}
		}

		// Best location (centroid of most common cluster)
		const clusters = clusterLocations(encs);
		let bestCluster: Encounter[] = [];
		let maxClusterSize = 0;
		for (const [, cluster] of clusters) {
			if (cluster.length > maxClusterSize) {
				maxClusterSize = cluster.length;
				bestCluster = cluster;
			}
		}

		const centroid = {
			lat: bestCluster.reduce((s, e) => s + e.location.lat, 0) / bestCluster.length,
			lng: bestCluster.reduce((s, e) => s + e.location.lng, 0) / bestCluster.length
		};

		// Likelihood: based on frequency and recency
		const now = Date.now();
		const dayMs = 86400000;
		const recentCount = encs.filter((e) => now - e.timestamp.getTime() < 14 * dayMs).length;
		const frequency = Math.min(100, Math.round((recentCount / 14) * 100));
		const likelihood = Math.round(Math.min(95, Math.max(5, frequency + avgFriendliness * 5)));

		// Count unique reporters for paid tier
		const uniqueReporters = new Set(encs.map((e) => (e as any).reportedByUid).filter(Boolean));

		preds.push({
			dogName: encs[0].dogName, // preserve original casing
			likelihood,
			bestTime: formatHourRange(bestBucket),
			bestLocation: centroid,
			avgFriendliness,
			totalMeets: encs.length,
			basedOnUsers: isPaid ? uniqueReporters.size : undefined
		});
	}

	// Sort by likelihood descending
	preds.sort((a, b) => b.likelihood - a.likelihood);
	predictions.set(preds);
	return preds;
}

export async function loadGlobalEncountersForUser(uid: string): Promise<Encounter[]> {
	const db = getFirebaseDb();

	// First get all users this user has met
	const userEncs = get(encounters);
	const metUserIds = new Set(userEncs.map((e) => e.metUserId).filter(Boolean) as string[]);

	if (metUserIds.size === 0) return [];

	// Query global encounters from those users
	const globalRef = collection(db, 'encounters_global');
	const allGlobal: Encounter[] = [];

	// Firestore 'in' queries limited to 30, so chunk
	const idArray = Array.from(metUserIds);
	for (let i = 0; i < idArray.length; i += 30) {
		const chunk = idArray.slice(i, i + 30);
		const q = query(globalRef, where('reportedByUid', 'in', chunk), orderBy('timestamp', 'desc'), limit(500));
		const snap = await getDocs(q);
		for (const doc of snap.docs) {
			const d = doc.data();
			allGlobal.push({
				id: doc.id,
				dogName: d.dogName,
				friendliness: d.friendliness,
				notes: d.notes,
				location: d.location,
				timestamp: d.timestamp?.toDate() || new Date(),
				metUserId: d.metUserId
			});
		}
	}

	return allGlobal;
}
