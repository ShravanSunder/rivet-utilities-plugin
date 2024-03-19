import type { DataValue, VectorDataValue } from '@ironclad/rivet-core';
import { match } from 'ts-pattern';
import { PineconeSparseVector, pineconeSparseVectorSchema } from './PineconeSparseVector';
import { z } from 'zod';
import { pineconeMetadataSchema } from './PineconeMetadata';

const pineconeQueryBaseSchema = z.object({
	collectionUrl: z.string(),
	topK: z.number(),
	includeValues: z.boolean(),
	includeMetadata: z.boolean(),
	namespace: z.string(),
	filter: z.record(z.unknown()),
	alpha: z.number().refine((n) => n >= 0 && n <= 1, { message: 'Alpha must be between 0 and 1' }),
});

export const pineconeQueryWithVectorSchema = pineconeQueryBaseSchema.extend({
	vector: z.array(z.number()),
	sparseVector: pineconeSparseVectorSchema.optional(),
});

export const pineconeQueryWithIdSchema = pineconeQueryBaseSchema.extend({
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
