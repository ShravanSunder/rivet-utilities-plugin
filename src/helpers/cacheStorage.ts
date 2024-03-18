import type { NodeGraph, Outputs } from '@ironclad/rivet-core';
import { compressObject, decompressObject } from './lzObject.js';
import { createDigest } from './createDigest.js';

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
const cacheNamespaceMap: Map<string, CacheStorage> = new Map();

const DEBUG_CACHE = false;

/**
 * Invalidates the cache if the digest has changed.
 * @param cacheStorage - The cache storage object.
 * @param digest - The digest to compare against the cache storage's revalidation digest.
 */
export const invalideCacheIfChanges = (cacheStorage: CacheStorage, digest: string) => {
	if (cacheStorage.revalidationDigest !== digest) {
		if (DEBUG_CACHE)
			console.log('iterator', 'invalidate cache', {
				cacheStorage,
				digest,
				cacheNamespaceMap,
			});
		cacheStorage.cache.clear();
		cacheStorage.revalidationDigest = digest;
	}
};

/**
 * Cleans up expired cache entries.
 * @returns A Promise that resolves once the expired cache entries have been cleaned up.
 */
export const cleanExpiredCache = async (): Promise<void> => {
	const now = Date.now();
	cacheNamespaceMap.forEach((value, key) => {
		if (value.expiryTimestamp < now) {
			if (DEBUG_CACHE)
				console.log('iterator', 'delete cache', {
					key,
					value,
				});
			cacheNamespaceMap.delete(key);
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
	let cacheStorage = cacheNamespaceMap.get(namespace);
	if (!cacheStorage) {
		cacheStorage = {
			cache: new Map<string, string>(),
			expiryTimestamp: Date.now() + 3 * 60 * 60 * 1000 /** 3 hours */,
			revalidationDigest,
		};
		cacheNamespaceMap.set(namespace, cacheStorage);
	}

	return cacheStorage;
};

export const getCachedItem = async <T extends Record<string, unknown>>(
	cacheStorage: CacheStorage,
	cacheKey: string
): Promise<T | null> => {
	const cachedOutputCompressed = cacheStorage.cache.get(cacheKey);
	if (DEBUG_CACHE)
		console.log('iterator', 'get cache', {
			cacheKey,
			cachedOutputCompressed,
			cacheNamespaceMap,
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
		console.log('iterator', 'set cache', {
			cacheKey,
			compressedOutput,
			cacheNamespaceMap,
		});
};

/**
 * Creates a digest for the given graph.  This can be used to invalidate the cache if the graph changes.
 * @param graph The NodeGraph object to create a digest for.
 * @returns A Promise that resolves to the digest of the graph.
 */
export const createGraphDigest = async (graph: NodeGraph) => {
	return await createDigest(JSON.stringify(graph.nodes.map((m) => m.data)));
};
