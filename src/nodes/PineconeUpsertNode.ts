// **** IMPORTANT ****
// Make sure you do `import type` and do not pull in the entire Rivet core library here.
// Export a function that takes in a Rivet object, and you can access rivet library functionality
// from there.
import type {
	ObjectDataValue,
	ChartNode,
	EditorDefinition,
	Inputs,
	InternalProcessContext,
	NodeBodySpec,
	NodeConnection,
	NodeId,
	NodeInputDefinition,
	NodeOutputDefinition,
	NodeUIData,
	Outputs,
	PluginNodeImpl,
	PortId,
	Project,
	Rivet,
	isScalarDataType,
	isArrayDataType,
	isFunctionDataType,
	NodeGraph,
	LooseDataValue,
	DataValue,
} from '@ironclad/rivet-core';
import { PineconeMetadata, pineconeMetadataSchema } from '../helpers/models/PineconeMetadata.js';
import { PineconeVectorDatabase } from '../helpers/PineconeVectorDatabase.js';
import { PineconeQuery, PineconeQueryResult } from '../helpers/models/PineconeQuery.js';
import { PineconeSparseVector, pineconeSparseVectorSchema } from '../helpers/models/PineconeSparseVector.js';
import { ZodError, z } from 'zod';
import { PineconeUpsertRequest, pineconeUpsertRequestSchema } from '../helpers/models/PineconeUpsert.js';

const pineconeUpsertIds = {
	error: 'error' as PortId,
	collectionUrl: 'collectionUrl' as PortId,
	vector: 'vector' as PortId,
	namespace: 'namespace' as PortId,
	metadata: 'metadata' as PortId,
	sparseVector: 'sparseVector' as PortId,
	ok: 'ok' as PortId,
	response: 'response' as PortId,
	id: 'id' as PortId,
	vectorArray: 'vectorArray' as PortId,
} as const;

export type PineconeUpsertNode = ChartNode<'pineconeUpsertNode', PineconeUpsertNodeData>;

export type PineconeUpsertNodeData = {
	collectionUrl: string;
	useCollectionUrlInput?: boolean;
	namespace: string;
	useNamespaceInput?: boolean;
	useVectorArray?: boolean;
	ok: boolean;
};

// The function that defines the plugin node for Vector Nearest Neighbors.
export function registerPineconeUpsertNode(rivet: typeof Rivet) {
	// Define the implementation of the node
	const PineconeUpsertNodeImpl: PluginNodeImpl<PineconeUpsertNode> = {
		create(): PineconeUpsertNode {
			return {
				id: rivet.newId() as NodeId,
				type: 'pineconeUpsertNode',
				title: 'Pinecone Upsert',
				visualData: { x: 0, y: 0, width: 200 },
				data: {
					ok: false,
					collectionUrl: '',
					useCollectionUrlInput: false,
					useVectorArray: false,
					namespace: '',
				},
			};
		},

		getInputDefinitions(data): NodeInputDefinition[] {
			const inputs: NodeInputDefinition[] = [];

			if (data.useCollectionUrlInput) {
				inputs.push({
					id: pineconeUpsertIds.collectionUrl,
					title: 'Collection Url',
					dataType: 'string',
					required: true,
				});
			}

			if (data.useNamespaceInput) {
				inputs.push({
					id: pineconeUpsertIds.namespace,
					title: 'Namespace',
					dataType: 'string',
					required: true,
				});
			}

			if (data.useVectorArray) {
				inputs.push({
					id: pineconeUpsertIds.vectorArray,
					title: 'Vector Array',
					dataType: 'object[]',
					required: true,
				});
			} else {
				inputs.push({
					id: pineconeUpsertIds.id,
					title: 'ID',
					dataType: 'string',
					required: true,
				});

				inputs.push({
					id: pineconeUpsertIds.vector,
					title: 'Vector',
					dataType: 'vector',
					required: true,
				});

				inputs.push({
					id: pineconeUpsertIds.metadata,
					title: 'Metadata',
					dataType: 'object',
					required: false,
				});

				inputs.push({
					id: pineconeUpsertIds.sparseVector,
					title: 'Sparse Vector',
					dataType: 'object',
					required: false,
				});
			}

			return inputs;
		},

		getOutputDefinitions(): NodeOutputDefinition[] {
			return [
				{
					id: pineconeUpsertIds.ok,
					title: 'ok',
					dataType: 'boolean',
				},
			];
		},

		getUIData(): NodeUIData {
			return {
				infoBoxBody: rivet.dedent`
          A Pinecone upsert node.  This node will upsert a vector into a Pinecone collection. It can upsert a single vector or an array of vectors.
        `,
				infoBoxTitle: 'Pinecone Upsert Node',
				contextMenuTitle: 'Pinecone Upsert',
				group: ['Input/Output'],
			};
		},

		getEditors(_nodeData): EditorDefinition<PineconeUpsertNode>[] {
			return [
				{
					type: 'string',
					dataKey: 'collectionUrl',
					label: 'Collection Url',
					helperMessage: 'The collection url to upsert',
					useInputToggleDataKey: 'useCollectionUrlInput',
				},
				{
					type: 'string',
					dataKey: 'namespace',
					label: 'Namespace',
					helperMessage: 'The namespace to upsert',
					useInputToggleDataKey: 'useNamespaceInput',
				},
				{
					type: 'toggle',
					dataKey: 'useVectorArray',
					label: 'Use Array Vector Payload',
					helperMessage: 'Upsert an array of vectors instead of a single vector',
				},
			];
		},
		// This function returns the body of the node when it is rendered on the graph. You should show
		// what the current data of the node is in some way that is useful at a glance.
		getBody(data: PineconeUpsertNodeData): string | NodeBodySpec | NodeBodySpec[] | undefined {
			return rivet.dedent`Collection Url: ${data.useCollectionUrlInput ? '(using input)' : data.collectionUrl}
				Namespace: ${data.useNamespaceInput ? '(using input)' : data.namespace ?? ''}
			`;
		},

		async process(data: PineconeUpsertNodeData, inputData: Inputs, context: InternalProcessContext): Promise<Outputs> {
			try {
				const apiKey = context.getPluginConfig('pineconeApiKey');
				const output: Outputs = {};

				const collectionUrl = data.useCollectionUrlInput
					? rivet.coerceType(inputData[pineconeUpsertIds.collectionUrl], 'string')
					: data.collectionUrl;
				const namespace = data.useNamespaceInput
					? rivet.coerceType(inputData[pineconeUpsertIds.namespace], 'string')
					: data.namespace ?? '';

				if (!apiKey) {
					output[pineconeUpsertIds.ok] = {
						type: 'control-flow-excluded',
						value: undefined,
					};
					output[pineconeUpsertIds.error] = {
						type: 'string',
						value: 'Missing Pinecone API key',
					};
					return output;
				}
				const db = new PineconeVectorDatabase(rivet, apiKey);

				if (data.useVectorArray) {
					/**
					 * If the node is configured to use an array payload, we expect the input to be an array of PineconeUpsertRequest
					 */
					const vectorArray = pineconeUpsertRequestSchema.shape.vectors.parse(
						rivet.coerceType(inputData[pineconeUpsertIds.vectorArray], 'object[]')
					);

					const result = await db.upsert({
						collectionUrl: collectionUrl,
						namespace: namespace,
						vectors: vectorArray,
					});

					output[pineconeUpsertIds.ok] = {
						type: 'boolean',
						value: result,
					};
					output[pineconeUpsertIds.response] = {
						type: 'string',
						value: result ? 'Upsert successful' : 'Upsert failed',
					};

					return output;
				}

				const id = rivet.coerceType(inputData[pineconeUpsertIds.id], 'string');
				const vector = rivet.coerceType(inputData[pineconeUpsertIds.vector], 'vector');
				const metadata = pineconeMetadataSchema.parse(
					rivet.coerceTypeOptional(inputData[pineconeUpsertIds.metadata], 'object') ?? {}
				);
				const sparseVector = pineconeSparseVectorSchema
					.nullish()
					.parse(rivet.coerceTypeOptional(inputData[pineconeUpsertIds.sparseVector], 'object'));
				const result = await db.upsert({
					collectionUrl: collectionUrl,
					namespace: namespace,
					vectors: [
						{
							id,
							metadata: metadata,
							values: vector,
							...(sparseVector ? { sparseValues: sparseVector } : null),
						},
					],
				});

				output[pineconeUpsertIds.ok] = {
					type: 'boolean',
					value: result,
				};
				output[pineconeUpsertIds.response] = {
					type: 'string',
					value: result ? 'Upsert array successful' : 'Upsert array failed',
				};

				return output;
			} catch (cause) {
				if (cause instanceof ZodError) {
					return {
						[pineconeUpsertIds.ok]: {
							type: 'control-flow-excluded',
							value: undefined,
						},
						[pineconeUpsertIds.error]: {
							type: 'string',
							value: `Error with inputs: ${cause.errors.map((e) => e.message).join(', ')}`,
						},
					};
				}
				return {
					[pineconeUpsertIds.ok]: {
						type: 'control-flow-excluded',
						value: undefined,
					},
					[pineconeUpsertIds.error]: {
						type: 'string',
						value: (cause as Error).message,
					},
				};
			}
		},
	};

	// Register the node implementation with Rivet and return its definition
	return rivet.pluginNodeDefinition(PineconeUpsertNodeImpl, 'Pinecone Upsert Node');
}
