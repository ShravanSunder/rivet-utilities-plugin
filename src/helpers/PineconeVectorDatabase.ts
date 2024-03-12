import type { ArrayDataValue, DataValue, ScalarDataValue, VectorDataValue, coerceType,  Settings,  VectorDatabase, Rivet } from "@ironclad/rivet-core";
import { PineconeMetadata } from "./models/PineconeMetadata";

export class PineconeVectorDatabase {
  readonly #apiKey;
  #rivet;

  constructor(rivet: typeof Rivet, settings: Settings) {
    this.#apiKey = settings.pluginSettings?.pinecone?.pineconeApiKey as string | undefined;
    this.#rivet = rivet;
  }

  async store(params: {collection: DataValue, vector: VectorDataValue, data: PineconeMetadata, id?: string }): Promise<void> {
    const collectionDetails = getCollection(this.#rivet.coerceType(params.collection, 'string'));

    if (!params.id) {
      params.id = CryptoJS.SHA256(params.vector.value.join(',')).toString(CryptoJS.enc.Hex);
    }

    let metadata: Record<string, unknown> = {}
    if (params.data.type === 'object') {
      metadata = params.data.value;
    }
    else {
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
        ...collectionDetails.options,
      }),
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'api-key': this.#apiKey!,
      },
    });

    if (response.status !== 200) {
      throw new Error(`Pinecone error: ${await response.text()}`);
    }
  }

  async nearestNeighbors(
    params: 
    {collection: DataValue,
    vector: VectorDataValue,
    k: number,}
  ): Promise<ArrayDataValue<ScalarDataValue>> {
    const collectionDetails = getCollection(this.#rivet.coerceType(params.collection, 'string'));

    const response = await fetch(`${collectionDetails.host}/query`, {
      method: 'POST',
      body: JSON.stringify({
        vector: params.vector.value,
        topK: params.k,
        includeMetadata: true,
        ...collectionDetails.options,
      }),
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'api-key': this.#apiKey!,
      },
    });

    if (response.status !== 200) {
      throw new Error(`Pinecone error: ${await response.text()}`);
    }

    const responseData = await response.json();

    const { matches } = responseData as {
      matches: {
        id: string;
        score: number;
        metadata: { data: unknown };
      }[];
    };

    return {
      type: 'object[]',
      value: matches.map(({ id, metadata }) => ({ id, data: metadata.data, metadata })),
    };
  }
}

interface CollectionDetails {
  host: string;
  options: { [option: string]: any };
}

function getCollection(collectionString: string): CollectionDetails {
  let collectionURL: URL;

  if (!collectionString.startsWith('http://') && !collectionString.startsWith('https://')) {
    collectionString = `https://${collectionString}`;
  }

  try {
    collectionURL = new URL(collectionString);
  } catch (error) {
    throw new Error(`Incorrectly formatted Pinecone collection: ${error}`);
  }

  const host = `${collectionURL.protocol}//${collectionURL.host}`;
  const options: { [option: string]: any } = {};

  if (collectionURL.pathname !== '/') {
    // Chop off the leading slash.
    options.namespace = collectionURL.pathname.slice(1);
  }

  return { host, options };
}
