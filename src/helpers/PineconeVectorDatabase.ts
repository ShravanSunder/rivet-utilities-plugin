import type {
	ArrayDataValue,
	DataValue,
	ScalarDataValue,
	VectorDataValue,
	coerceType,
	Settings,
	VectorDatabase,
	Rivet,
} from '@ironclad/rivet-core';
import { PineconeMetadataInputValue } from './models/PineconeMetadata';
import sha256 from 'crypto-js/sha256';
import { createDigest } from './createDigest';
import { PineconeQuery, PineconeQueryResult } from './models/PineconeQuery';

export class PineconeVectorDatabase {
	readonly #apiKey: string;
	#rivet;

	constructor(rivet: typeof Rivet, apiKey: string) {
		this.#apiKey = apiKey;
		this.#rivet = rivet;
	}

	async store(params: {
		collection: DataValue;
		vector: VectorDataValue;
		data: PineconeMetadataInputValue;
		namespace: string;
		id?: string;
	}): Promise<void> {
		const collectionDetails = getCollection(this.#rivet.coerceType(params.collection, 'string'));

		if (!params.id) {
			params.id = await createDigest(params.vector.value.join(','));
		}

		let metadata: Record<string, unknown> = {};
		if (params.data.type === 'object') {
			metadata = params.data.value;
		} else {
			metadata = { data: params.data.value };
		}

		const response = await fetch(`${collectionDetails.host}/vectors/upsert`, {
			method: 'POST',
			body: JSON.stringify({
				vectors: [
					{
						id: params.id,
						values: params.vector.value,
						metadata,
					},
				],
			}),
			headers: {
				'Content-Type': 'application/json',
				Accept: 'application/json',
				'api-key': this.#apiKey,
			},
		});

		if (response.status !== 200) {
			throw new Error(`Pinecone error: ${await response.text()}`);
		}
	}

	async query(params: PineconeQuery): Promise<PineconeQueryResult> {
		const collectionDetails = getCollection(params.collectionUrl);
		const req: Record<string, unknown> = params;

		console.log('pinecone', req);

		const response = await fetch(`${collectionDetails.host}/query`, {
			method: 'POST',
			body: JSON.stringify({
				...req,
			}),
			headers: {
				'Content-Type': 'application/json',
				Accept: 'application/json',
				'Api-Key': this.#apiKey,
			},
		});

		if (response.status !== 200) {
			throw new Error(`Pinecone error: ${await response.text()}`);
		}

		const responseData = (await response.json()) as PineconeQueryResult;
		return responseData;
	}
}

interface CollectionDetails {
	host: string;
}

function getCollection(collectionUrlString: string): CollectionDetails {
	let collectionURL: URL;

	try {
		collectionURL = new URL(collectionUrlString);
	} catch (error) {
		throw new Error(`Incorrectly formatted Pinecone collection: ${error}`);
	}

	const host = `${collectionURL.protocol}//${collectionURL.host}`;
	return { host };
}
