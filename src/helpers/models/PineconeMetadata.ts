import type { ObjectDataValue, StringDataValue, NumberDataValue, StringArrayDataValue } from '@ironclad/rivet-core';

/**
 * A value that represents a Pinecone metadata object that can be used by Nodes as input
 */
export type PineconeMetadataInputValue = ObjectDataValue | StringDataValue | NumberDataValue | StringArrayDataValue;

/**
 * A value that represents a Pinecone metadata for the api
 * See also {@link PineconeMetadataInputValue}
 */
export type PineconeMetadata = Record<string, string | number | boolean | string[]>;
