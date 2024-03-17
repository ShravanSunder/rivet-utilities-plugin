import type { DataValue, VectorDataValue } from '@ironclad/rivet-core';
import { match } from 'ts-pattern';
import { PineconeSparseVector } from './PineconeSparseVector';
import { z } from 'zod';
import { pineconeMetadataSchema } from './PineconeMetadata';

const PineconeQueryBase = z.object({
	collectionUrl: z.string(),
	topK: z.number(),
	includeValues: z.boolean(),
	includeMetadata: z.boolean(),
	namespace: z.string(),
	filter: z.record(z.unknown()),
});

export const pineconeQueryWithVectorSchema = PineconeQueryBase.extend({
	vector: z.array(z.number()),
	sparseVector: PineconeSparseVector.optional(),
});

export const pineconeQueryWithIdSchema = PineconeQueryBase.extend({
	id: z.string(),
});

export const pineconeQuerySchema = z.union([pineconeQueryWithVectorSchema, pineconeQueryWithIdSchema]);
export type PineconeQuery = z.infer<typeof pineconeQuerySchema>;

export const pineconeQueryResultSchema = z.object({
	matches: z.array(
		z.object({
			id: z.string(),
			score: z.number(),
			values: z.array(z.number()),
			metadata: pineconeMetadataSchema,
		})
	),
	namespace: z.string(),
	usage: z.record(z.unknown()),
});

export type PineconeQueryResult = z.infer<typeof pineconeQueryResultSchema>;
