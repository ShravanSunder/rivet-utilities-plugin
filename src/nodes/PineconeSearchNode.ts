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

export type PineconeSearchNode = ChartNode<'pineconeSearchNode', PineconeSearchNodeData>;

export type PineconeSearchNodeData = {
	k: number;
	useKInput?: boolean;

	collectionId: string;
	useCollectionIdInput?: boolean;
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
					collectionId: '',
					useKInput: false,
					useCollectionIdInput: false,
				},
			};
		},

		getInputDefinitions(data): NodeInputDefinition[] {
			const inputDefinitions: NodeInputDefinition[] = [];

			inputDefinitions.push({
				id: 'vector' as PortId,
				title: 'Vector',
				dataType: 'vector',
				required: true,
			});

			if (data.useCollectionIdInput) {
				inputDefinitions.push({
					id: 'collectionId' as PortId,
					title: 'Collection ID',
					dataType: 'string',
					required: true,
				});
			}

			if (data.useKInput) {
				inputDefinitions.push({
					id: 'k' as PortId,
					title: 'K',
					dataType: 'number',
					required: true,
				});
			}

			return inputDefinitions;
		},

		getOutputDefinitions(): NodeOutputDefinition[] {
			return [
				{
					id: 'results' as PortId,
					title: 'Results',
					dataType: 'any[]',
				},
			];
		},

		getEditors(nodeData): EditorDefinition<PineconeSearchNode>[] {
			return [
				// Define editor configurations here
			];
		},
		// This function returns the body of the node when it is rendered on the graph. You should show
		// what the current data of the node is in some way that is useful at a glance.
		getBody(data: PineconeSearchNodeData): string | NodeBodySpec | NodeBodySpec[] | undefined {
			return rivet.dedent`
      K: ${data.useKInput ? '(using input)' : data.k}
      Collection Id: ${data.useCollectionIdInput ? '(using input)' : data.collectionId}
    `;
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

		async process(inputs: Inputs, context: InternalProcessContext): Promise<Outputs> {
			const apiKey = context.settings.pluginSettings?.iteratorPlugin?.pineconeApiKey as string;

			if (!!!apiKey) {
				const output: Outputs = {};
				output['error' as PortId] = {
					type: 'control-flow-excluded',
					value: undefined,
				};
			}
      
			const output: Outputs = {};
			output['results' as PortId] = {
				type: 'any',
				value: 'afdkdsjkdsfksdf',
			};
			// Implement the processing logic here
			return output;
		},
	};

	// Register the node implementation with Rivet and return its definition
	return rivet.pluginNodeDefinition(PineconeSearchNodeImpl, 'Pinecone Search');
}
