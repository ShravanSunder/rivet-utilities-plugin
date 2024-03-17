import { z } from 'zod';
import { pineconeMetadataSchema } from './PineconeMetadata';
import { pineconeSparseVectorSchema } from './PineconeSparseVector';

export const pineconeVectorPayload = z.object({
	id: z.string(),
	metadata: pineconeMetadataSchema.optional(),
	values: z.array(z.number()),
	sparseValues: pineconeSparseVectorSchema.optional(),
});

export const pineconeUpsertRequestSchema = z.object({
	vectors: pineconeVectorPayload.array(),
	namespace: z.string(),
	collectionUrl: z.string(),
});

export type PineconeUpsertRequest = z.infer<typeof pineconeUpsertRequestSchema>;
