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
import { PineconeQuery, PineconeQueryResult } from './models/PineconeQuery';
import { PineconeSparseVector } from './models/PineconeSparseVector';
import { PineconeUpsertRequest } from './models/PineconeUpsert';
import { stringify } from 'superjson';

/**
 * Retrieves the host from a given Pinecone collection URL.
 * @param collectionUrlString - The URL of the Pinecone collection.
 * @returns An object containing the host extracted from the URL.
 * @throws {Error} If the Pinecone collection URL is incorrectly formatted.
 */
const getCollection = (collectionUrlString: string): { host: string } => {
	let collectionURL: URL;

	try {
		collectionURL = new URL(collectionUrlString);
	} catch (error) {
		throw new Error(`Incorrectly formatted Pinecone collection: ${error}`);
	}

	const host = `${collectionURL.protocol}//${collectionURL.host}`;
	return { host };
};

/**
 * Class to interact with Pinecone Vector Database.
 */
export class PineconeVectorDatabase {
	readonly #apiKey: string;
	#rivet;

	constructor(rivet: typeof Rivet, apiKey: string) {
		this.#apiKey = apiKey;
		this.#rivet = rivet;
	}

	async upsert(params: PineconeUpsertRequest): Promise<true> {
		const collectionDetails = getCollection(params.collectionUrl);

		const vectors = params.vectors.map((v) => {
			return {
				...v,
			};
		});

		const response = await fetch(`${collectionDetails.host}/vectors/upsert`, {
			method: 'POST',
			body: stringify({
				vectors,
				namespace: params.namespace,
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

		return true;
	}

	async query(params: PineconeQuery): Promise<PineconeQueryResult> {
		const collectionDetails = getCollection(params.collectionUrl);
		const req: Record<string, unknown> = params;
		if ('sparseVector' in params && 'vector' in params && params.sparseVector != null && params.alpha != null) {
			const transform = this.hybridScoreWeighting(params.vector, params.sparseVector, params.alpha);
			req.vector = transform.vector;
			req.sparseVector = transform.sparseVector;
		}

		const response = await fetch(`${collectionDetails.host}/query`, {
			method: 'POST',
			body: stringify({
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

	/**
	 * Computes the hybrid score norm by modifying the given vector and sparse vector.
	 * The vector is modified by multiplying each element by the alpha value,
	 * while the sparse vector is modified by multiplying each value by (1 - alpha).
	 * @param vector - The input vector.
	 * @param sparseVector - The input sparse vector.
	 * @param alpha - The alpha value between 0 and 1.
	 * @returns An object containing the modified vector and sparse vector.
	 * @throws {Error} If the alpha value is not between 0 and 1.
	 */
	hybridScoreWeighting(
		vector: number[],
		sparseVector: PineconeSparseVector,
		alpha: number
	): { vector: number[]; sparseVector: PineconeSparseVector } {
		if (alpha < 0 || alpha > 1) {
			throw new Error('Alpha must be between 0 and 1');
		}

		// Computing the sparse values modified by (1 - alpha)
		const modifiedSparse: PineconeSparseVector = {
			indices: sparseVector.indices,
			values: sparseVector.values.map((v) => v * (1 - alpha)),
		};

		// Computing the dense values modified by alpha
		const modifiedVector = vector.map((v) => v * alpha);

		return { vector: modifiedVector, sparseVector: modifiedSparse };
	}
}
