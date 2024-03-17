import type { ObjectDataValue, StringDataValue, NumberDataValue, StringArrayDataValue } from '@ironclad/rivet-core';
import { z } from 'zod';

/**
 * A value that represents a Pinecone metadata object that can be used by Nodes as input
 */
export type PineconeMetadataInputValue = ObjectDataValue | StringDataValue | NumberDataValue | StringArrayDataValue;

export const pineconeMetadataSchema = z.record(z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]));

/**
 * A value that represents a Pinecone metadata for the api
 * See also {@link PineconeMetadataInputValue}
 */
export type PineconeMetadata = z.infer<typeof pineconeMetadataSchema>;
