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
import { PineconeMetadata, pineconeMetadataSchema } from '../helpers/models/PineconeMetadata';
import { PineconeVectorDatabase } from '../helpers/PineconeVectorDatabase';
import { PineconeQuery, PineconeQueryResult } from '../helpers/models/PineconeQuery';
import { PineconeSparseVector, pineconeSparseVectorSchema } from '../helpers/models/PineconeSparseVector';
import { z } from 'zod';

const pineconeSearchIds = {
	matches: 'matches' as PortId,
	error: 'error' as PortId,
	topK: 'topK' as PortId,
	collectionUrl: 'collectionUrl' as PortId,
	vector: 'vector' as PortId,
	namespace: 'namespace' as PortId,
	filter: 'filter' as PortId,
	usage: 'usage' as PortId,
	sparseVector: 'sparseVector' as PortId,
	alpha: 'alpha' as PortId,
} as const;

export type PineconeSearchNode = ChartNode<'pineconeSearchNode', PineconeSearchNodeData>;

export type PineconeSearchNodeData = {
	topK: number;
	useTopKInput?: boolean;
	collectionUrl: string;
	useCollectionUrlInput?: boolean;
	alpha: number;
	useAlphaInput?: boolean;
	namespace: string;
	useNamespaceInput?: boolean;
};

// The function that defines the plugin node for Vector Nearest Neighbors.
export function createPineconeSearchNode(rivet: typeof Rivet) {
	// Define the implementation of the node
	const PineconeSearchNodeImpl: PluginNodeImpl<PineconeSearchNode> = {
		create(): PineconeSearchNode {
			return {
				id: rivet.newId() as NodeId,
				type: 'pineconeSearchNode',
				title: 'Pinecone Search',
				visualData: { x: 0, y: 0, width: 200 },
				data: {
					topK: 10,
					alpha: 0.5,
					collectionUrl: '',
					useTopKInput: false,
					useCollectionUrlInput: false,
					namespace: '',
				},
			};
		},

		getInputDefinitions(data): NodeInputDefinition[] {
			const inputs: NodeInputDefinition[] = [];

			if (data.useCollectionUrlInput) {
				inputs.push({
					id: pineconeSearchIds.collectionUrl,
					title: 'Collection Url',
					dataType: 'string',
					required: true,
				});
			}

			inputs.push({
				id: pineconeSearchIds.vector,
				title: 'Vector',
				dataType: 'vector',
				required: true,
			});

			if (data.useTopKInput) {
				inputs.push({
					id: pineconeSearchIds.topK,
					title: 'TopK',
					dataType: 'number',
					required: true,
				});
			}

			if (data.useNamespaceInput) {
				inputs.push({
					id: pineconeSearchIds.namespace,
					title: 'Namespace',
					dataType: 'string',
					required: true,
				});
			}

			if (data.useAlphaInput) {
				inputs.push({
					id: pineconeSearchIds.alpha,
					title: 'Alpha',
					dataType: 'number',
					required: true,
				});
			}

			inputs.push({
				id: pineconeSearchIds.filter,
				title: 'Filter',
				dataType: 'object',
				required: false,
			});

			inputs.push({
				id: pineconeSearchIds.sparseVector,
				title: 'Sparse Vector',
				dataType: 'object',
				required: false,
			});

			return inputs;
		},

		getOutputDefinitions(): NodeOutputDefinition[] {
			return [
				{
					id: pineconeSearchIds.matches,
					title: 'Matches',
					dataType: 'any[]',
				},
				{
					id: pineconeSearchIds.usage,
					title: 'Usage',
					dataType: 'object',
				},
			];
		},

		getUIData(): NodeUIData {
			return {
				infoBoxBody: rivet.dedent`
          A Pinecone search node.  Performs a k-nearest neighbors search on the vectors along with filter options.  Returns the k-nearest neighbors as a list of vectors and data
        `,
				infoBoxTitle: 'Pinecone Search Node',
				contextMenuTitle: 'Pinecone Search',
				group: ['Input/Output'],
			};
		},

		getEditors(_nodeData): EditorDefinition<PineconeSearchNode>[] {
			return [
				{
					type: 'number',
					dataKey: 'topK',
					label: 'topK',
					defaultValue: 10,
					helperMessage: 'The number of nearest neighbors to return',
					useInputToggleDataKey: 'useTopKInput',
				},
				{
					type: 'string',
					dataKey: 'collectionUrl',
					label: 'Collection Url',
					helperMessage: 'The collection url to search',
					useInputToggleDataKey: 'useCollectionUrlInput',
				},
				{
					type: 'string',
					dataKey: 'namespace',
					label: 'Namespace',
					helperMessage: 'The namespace to search',
					useInputToggleDataKey: 'useNamespaceInput',
				},
				{
					type: 'number',
					dataKey: 'alpha',
					label: 'Alpha',
					defaultValue: 0.5,
					helperMessage:
						'Alpha value for hybrid search. 0.5 is a balanced weighting. 0 is fully weighted to the dense vector.  1 is fully weighted to the sparse vector. (0 < alpha < 1)',
					useInputToggleDataKey: 'useAlphaInput',
				},
			];
		},
		// This function returns the body of the node when it is rendered on the graph. You should show
		// what the current data of the node is in some way that is useful at a glance.
		getBody(data: PineconeSearchNodeData): string | NodeBodySpec | NodeBodySpec[] | undefined {
			return rivet.dedent`TopK: ${data.useTopKInput ? '(using input)' : data.topK}
				Alpha: ${data.useAlphaInput ? '(using input)' : data.alpha}
				Collection Url: ${data.useCollectionUrlInput ? '(using input)' : data.collectionUrl}
				Namespace: ${data.useNamespaceInput ? '(using input)' : data.namespace ?? ''}
    	`;
		},

		async process(data: PineconeSearchNodeData, inputData: Inputs, context: InternalProcessContext): Promise<Outputs> {
			try {
				const apiKey = context.getPluginConfig('pineconeApiKey');
				const output: Outputs = {};

				const topK = data.useTopKInput
					? rivet.coerceType(inputData[pineconeSearchIds.topK], 'number')
					: data.topK ?? 10;
				const collectionUrl = data.useCollectionUrlInput
					? rivet.coerceType(inputData[pineconeSearchIds.collectionUrl], 'string')
					: data.collectionUrl;
				const namespace = data.useNamespaceInput
					? rivet.coerceType(inputData[pineconeSearchIds.namespace], 'string')
					: data.namespace ?? '';
				const vector = rivet.coerceType(inputData[pineconeSearchIds.vector], 'vector');
				const filter = z
					.record(z.unknown())
					.parse(rivet.coerceTypeOptional(inputData[pineconeSearchIds.filter], 'object') ?? {});
				const sparseVector = pineconeSparseVectorSchema
					.nullish()
					.parse(rivet.coerceTypeOptional(inputData[pineconeSearchIds.sparseVector], 'object'));

				const alpha = data.useAlphaInput
					? rivet.coerceType(inputData[pineconeSearchIds.alpha], 'number')
					: data.alpha ?? 0.5;

				if (!apiKey) {
					output[pineconeSearchIds.matches] = {
						type: 'control-flow-excluded',
						value: undefined,
					};
					output[pineconeSearchIds.error] = {
						type: 'string',
						value: 'Missing Pinecone API key',
					};
					return output;
				}

				const db = new PineconeVectorDatabase(rivet, apiKey);
				const result = await db.query({
					collectionUrl: collectionUrl,
					topK: topK,
					namespace: namespace,
					alpha: alpha,
					vector: vector,
					filter: filter,
					...(sparseVector ? { sparseVector: sparseVector } : null),
					includeValues: false,
					includeMetadata: true,
				});

				output[pineconeSearchIds.matches] = {
					type: 'any[]',
					value: result.matches,
				};
				output[pineconeSearchIds.usage] = {
					type: 'object',
					value: result.usage,
				};

				return output;
			} catch (cause) {
				return {
					[pineconeSearchIds.matches]: {
						type: 'control-flow-excluded',
						value: undefined,
					},
					[pineconeSearchIds.error]: {
						type: 'string',
						value: (cause as Error).message,
					},
				};
			}
		},
	};

	// Register the node implementation with Rivet and return its definition
	return rivet.pluginNodeDefinition(PineconeSearchNodeImpl, 'Pinecone Search Node');
}
