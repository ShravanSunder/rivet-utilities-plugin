import type { NodeGraph, Outputs } from '@ironclad/rivet-core';
import { compressObject, decompressObject } from './lzObject.js';
import { createDigest } from './createDigest.js';
import { parse, stringify } from 'superjson';

export type CacheStorage = {
	/**
	 * Compressed Objects are stored
	 */
	cache: Map<string, string>;
	expiryTimestamp: number;
	/**
	 * We can use this to invalidate the cache if the digest changes
	 */
	revalidationDigest?: string;
};
/**
 * The id is the graphId associated with the call graph
 */
const storageMap: Map<string, CacheStorage> = new Map();

const DEBUG_CACHE = false;

/**
 * Cleans up expired cache entries.
 * @returns A Promise that resolves once the expired cache entries have been cleaned up.
 */
export const cleanExpiredCache = async (): Promise<void> => {
	const now = Date.now();
	storageMap.forEach((value, key) => {
		if (value.expiryTimestamp < now) {
			if (DEBUG_CACHE)
				console.log('cache', 'delete cache', {
					key,
					value,
				});
			storageMap.delete(key);

			global.localStorage?.removeItem?.(`cache-${key}`);
		} else {
			// if (DEBUG_CACHE)
			// 	console.log('cache', 'localstorage set cache', {
			// 		key,
			// 		value,
			// 	});
			global.localStorage?.setItem?.(`cache-${key}`, stringify(value));
		}
	});
};

/**
 * Retrieves or creates a cache storage object for the specified namespace.
 * If a cache storage object for the namespace already exists, it is returned.
 * Otherwise, a new cache storage object is created and returned.
 *
 * @param namespace - The namespace for the cache storage.
 * @param revalidationDigest - This digest is used to invalidate the cache.  This can be used for graph logic changes for example.  If the digest changes, the cache is invalidated.
 * @returns The cache storage object for the specified namespace.
 */
export const getCacheStorageForNamespace = (namespace: string, revalidationDigest: string): CacheStorage => {
	let cacheStorage = storageMap.get(namespace);
	if (cacheStorage?.cache == null) {
		const ls = global.localStorage?.getItem?.(`cache-${namespace}`);
		if (ls == null) {
			cacheStorage = {
				cache: new Map<string, string>(),
				expiryTimestamp: Date.now() + 3 * 60 * 60 * 1000 /** 3 hours */,
				revalidationDigest,
			};
		} else {
			cacheStorage = parse(ls) as CacheStorage;
		}
	}

	if (cacheStorage.revalidationDigest !== revalidationDigest) {
		cacheStorage.cache.clear();
		if (DEBUG_CACHE)
			console.log('cache', 'invalidate cache check', cacheStorage.cache, {
				cacheStorage,
				revalidationDigest,
				storageMap,
			});
		cacheStorage.revalidationDigest = revalidationDigest;
	}

	storageMap.set(namespace, cacheStorage);
	return cacheStorage;
};

export const getCachedItem = async <T extends Record<string, unknown>>(
	cacheStorage: CacheStorage,
	cacheKey: string
): Promise<T | null> => {
	const cachedOutputCompressed = cacheStorage.cache.get(cacheKey);
	if (DEBUG_CACHE && cachedOutputCompressed)
		console.log('cache', 'get cache item', {
			cacheKey,
			cachedOutputCompressed,
			storageMap,
		});

	return cachedOutputCompressed ? decompressObject<T>(cachedOutputCompressed) : null;
};

export const setCachedItem = async <T extends Record<string, unknown>>(
	cacheStorage: CacheStorage,
	cacheKey: string,
	item: T
): Promise<void> => {
	const compressedOutput = compressObject(item);
	cacheStorage.cache.set(cacheKey, compressedOutput);
	if (DEBUG_CACHE)
		console.log('cache', 'set cache item', {
			cacheKey,
			compressedOutput,
			storageMap,
		});
};

/**
 * Creates a digest for the given graph.  This can be used to invalidate the cache if the graph changes.
 * @param graph The NodeGraph object to create a digest for.
 * @returns A Promise that resolves to the digest of the graph.
 */
export const createGraphDigest = async (graphs: NodeGraph[]) => {
	const digest = await createDigest(
		stringify(
			graphs.map((g) => {
				return { nodes: g.nodes.map((m) => m.data), connections: g.connections };
			})
		)
	);
	// if (DEBUG_CACHE)
	// console.log('cache', 'create graphs digest', {
	// 	graphs,
	// 	digest,
	// });
	return digest;
};

export const createObjectDigest = async (object: Record<string, unknown>) => {
	const digest = await createDigest(stringify(object));
	if (DEBUG_CACHE)
		console.log('cache', 'create object digest', {
			object,
			digest,
		});
	return digest;
};
