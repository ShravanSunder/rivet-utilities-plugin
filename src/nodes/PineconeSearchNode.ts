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
import { PineconeMetadata } from '../helpers/models/PineconeMetadata';
import { PineconeVectorDatabase } from '../helpers/PineconeVectorDatabase';

const pineconeSearchIds = {
	results: 'results' as PortId,
	error: 'error' as PortId,
	k: 'k' as PortId,
	collectionUrl: 'collectionUrl' as PortId,
	vector: 'vector' as PortId,
	namespace: 'namespace' as PortId,
	filter: 'filter' as PortId,
} as const;

export type PineconeSearchNode = ChartNode<'pineconeSearchNode', PineconeSearchNodeData>;

export type PineconeSearchNodeData = {
	k: number;
	useKInput?: boolean;
	collectionUrl: string;
	useCollectionUrlInput?: boolean;
	namespace: string;
	useNamespaceInput?: boolean;
	vector: number[];
	filter: PineconeMetadata;
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
					k: 10,
					collectionUrl: '',
					useKInput: false,
					useCollectionUrlInput: false,
					namespace: '',
					vector: [],
					filter: {},
				},
			};
		},

		getInputDefinitions(data): NodeInputDefinition[] {
			const inputs: NodeInputDefinition[] = [];

			inputs.push({
				id: pineconeSearchIds.vector,
				title: 'Vector',
				dataType: 'vector',
				required: true,
			});

			if (data.useCollectionUrlInput) {
				inputs.push({
					id: pineconeSearchIds.collectionUrl,
					title: 'Collection ID',
					dataType: 'string',
					required: true,
				});
			}

			if (data.useKInput) {
				inputs.push({
					id: pineconeSearchIds.k,
					title: 'K',
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

			inputs.push({
				id: pineconeSearchIds.filter,
				title: 'Filter',
				dataType: 'object',
				required: true,
			});

			return inputs;
		},

		getOutputDefinitions(): NodeOutputDefinition[] {
			return [
				{
					id: pineconeSearchIds.results,
					title: 'Results',
					dataType: 'any[]',
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
		getEditors(nodeData): EditorDefinition<PineconeSearchNode>[] {
			return [
				{
					type: 'number',
					dataKey: 'k',
					label: 'k',
					defaultValue: 10,
					helperMessage: 'The number of nearest neighbors to return',
					useInputToggleDataKey: 'useKInput',
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
			];
		},
		// This function returns the body of the node when it is rendered on the graph. You should show
		// what the current data of the node is in some way that is useful at a glance.
		getBody(data: PineconeSearchNodeData): string | NodeBodySpec | NodeBodySpec[] | undefined {
			return rivet.dedent`
      K: ${data.useKInput ? '(using input)' : data.k}
      Collection Id: ${data.useCollectionUrlInput ? '(using input)' : data.collectionUrl}
    `;
		},

		async process(data: PineconeSearchNodeData, inputData: Inputs, context: InternalProcessContext): Promise<Outputs> {
			const apiKey = context.getPluginConfig('pineconeApiKey');
			const output: Outputs = {};
			if (!apiKey) {
				output[pineconeSearchIds.results];
				output[pineconeSearchIds.error] = {
					type: 'control-flow-excluded',
					value: undefined,
				};
				return output;
			}

			const k = data.useKInput ? rivet.coerceType(inputData[pineconeSearchIds.k], 'number') : data.k;
			const collectionUrl = data.useCollectionUrlInput
				? rivet.coerceType(inputData[pineconeSearchIds.collectionUrl], 'string')
				: data.collectionUrl;
			const namespace = data.useNamespaceInput
				? rivet.coerceType(inputData[pineconeSearchIds.namespace], 'string')
				: data.namespace;
			const vector = rivet.coerceType(inputData[pineconeSearchIds.vector], 'vector');
			const filter = rivet.coerceType(inputData[pineconeSearchIds.filter], 'object') as PineconeMetadata;

			const db = new PineconeVectorDatabase(rivet, apiKey);
			const results = await db.query({
				collectionUrl: collectionUrl,
				k: k,
				namespace: namespace,
				vector: vector,
				filter: filter,
				includeValues: true,
			});

			output[pineconeSearchIds.results] = results;
			// Implement the processing logic here
			return output;
		},
	};

	// Register the node implementation with Rivet and return its definition
	return rivet.pluginNodeDefinition(PineconeSearchNodeImpl, 'Pinecone Search');
}
