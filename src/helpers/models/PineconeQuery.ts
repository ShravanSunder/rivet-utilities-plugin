import type { DataValue, VectorDataValue } from '@ironclad/rivet-core';
import { PineconeMetadata } from './PineconeMetadata';
import { match } from 'ts-pattern';

export type PineconeQuery = {
	collectionUrl: string;
	k: number;
	includeValues: boolean;
	namespace: string;
	filter: PineconeMetadata;
} & ({ vector: number[] } | { id: string });

export type PineconeQueryResult = {
	matches: {
		id: string;
		score: number;
		values: number[];
		metadata: PineconeMetadata;
	};
	namespace: string;
	usage: Record<string, unknown>;
};
