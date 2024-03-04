// **** IMPORTANT ****
// Make sure you do `import type` and do not pull in the entire Rivet core library here.
// Export a function that takes in a Rivet object, and you can access rivet library functionality
// from there.
import {
	ObjectDataValue,
	type ChartNode,
	type EditorDefinition,
	type Inputs,
	type InternalProcessContext,
	type NodeBodySpec,
	type NodeConnection,
	type NodeId,
	type NodeInputDefinition,
	type NodeOutputDefinition,
	type NodeUIData,
	type Outputs,
	type PluginNodeImpl,
	type PortId,
	type Project,
	type Rivet,
} from '@ironclad/rivet-core';
import PQueue from 'p-queue';

// This defines your new type of node.
export type IteratorPluginNode = ChartNode<'iteratorPlugin', IteratorPluginNodeData>;

// This defines the data that your new node will store.
export type IteratorPluginNodeData = {
	results: any[];
	chunkSize: number;
	useChunkSizeToggle: boolean;
};

// Make sure you export functions that take in the Rivet library, so that you do not
// import the entire Rivet core library in your plugin.
export function iteratorPluginNode(rivet: typeof Rivet) {
	/**
	 * key is node id.  value is the index of the chunk[0] that the node is currently processing
	 */

	// This is your main node implementation. It is an object that implements the PluginNodeImpl interface.
	const IteratorPluginNodeImpl: PluginNodeImpl<IteratorPluginNode> = {
		// This should create a new instance of your node type from scratch.
		create(): IteratorPluginNode {
			const id = rivet.newId<NodeId>();
			const node: IteratorPluginNode = {
				// Use rivet.newId to generate new IDs for your nodes.
				id,

				// This is the default data that your node will store
				data: {
					results: [],
					chunkSize: 1,
					useChunkSizeToggle: false,
				},

				// This is the default title of your node.
				title: 'Iterator Plugin Node',

				// This must match the type of your node.
				type: 'iteratorPlugin',

				// X and Y should be set to 0. Width should be set to a reasonable number so there is no overflow.
				visualData: {
					x: 0,
					y: 0,
					width: 200,
				},
			};
			return node;
		},

		// This function should return all input ports for your node, given its data, connections, all other nodes, and the project. The
		// connection, nodes, and project are for advanced use-cases and can usually be ignored.
		getInputDefinitions(
			data: IteratorPluginNodeData,
			_connections: NodeConnection[],
			_nodes: Record<NodeId, ChartNode>,
			_project: Project
		): NodeInputDefinition[] {
			const inputs: NodeInputDefinition[] = [];

			inputs.push({
				id: 'graph' as PortId,
				dataType: 'graph-reference',
				title: 'Graph',
				description: 'The reference to the graph to call.',
				required: true,
			});

			inputs.push({
				id: 'inputArray' as PortId,
				dataType: 'object[]',
				title: 'Input Array',
				description: 'The array to iterate over.',
				required: true,
			});

			if (data.useChunkSizeToggle) {
				inputs.push({
					id: 'chunkSize' as PortId,
					dataType: 'number',
					title: 'Chunk Size',
					description: 'The concurrency limit: The number of items to process at the same time.',
					data: data.chunkSize,
				});
			}

			return inputs;
		},

		// This function should return all output ports for your node, given its data, connections, all other nodes, and the project. The
		// connection, nodes, and project are for advanced use-cases and can usually be ignored.
		getOutputDefinitions(
			data: IteratorPluginNodeData,
			_connections: NodeConnection[],
			_nodes: Record<NodeId, ChartNode>,
			_project: Project
		): NodeOutputDefinition[] {
			return [
				{
					id: 'outputData' as PortId,
					dataType: 'object[]',
					title: 'Output Data',
				},
			];
		},

		// This returns UI information for your node, such as how it appears in the context menu.
		getUIData(): NodeUIData {
			return {
				contextMenuTitle: 'Iterator Plugin',
				group: 'Logic',
				infoBoxBody: 'This is an iterator plugin node.  This node will map over an array and process each item with the graph provided.',
				infoBoxTitle: 'Iterator Plugin Node',
			};
		},

		// This function defines all editors that appear when you edit your node.
		getEditors(_data: IteratorPluginNodeData): EditorDefinition<IteratorPluginNode>[] {
			return [
				{
					type: 'number',
					dataKey: 'chunkSize',
					label: 'Chunk size',
					defaultValue: 1,
					helperMessage:
						'The number of items to process at the same time.  This will help process arrays quickly while not overloading the system.  Recommended to keep this below 10 for subgraphs that make network calls or stream model responses.',
					useInputToggleDataKey: 'useChunkSizeToggle',
				},
			];
		},

		// This function returns the body of the node when it is rendered on the graph. You should show
		// what the current data of the node is in some way that is useful at a glance.
		getBody(data: IteratorPluginNodeData): string | NodeBodySpec | NodeBodySpec[] | undefined {
			return rivet.dedent`
        Iterator Plugin Node
        Results: ${data.results}
      `;
		},

		// This is the main processing function for your node. It can do whatever you like, but it must return
		// a valid Outputs object, which is a map of port IDs to DataValue objects. The return value of this function
		// must also correspond to the output definitions you defined in the getOutputDefinitions function.
		async process(data: IteratorPluginNodeData, inputData: Inputs, context: InternalProcessContext): Promise<Outputs> {
			const outputs: Outputs = {};

			// get the inputs
			const graph = rivet.coerceType(inputData['graph' as PortId], 'graph-reference');
			const inputArray = rivet.coerceType(inputData['inputArray' as PortId], 'any[]');
			let chunkSize = rivet.coerceTypeOptional(inputData['chunkSize' as PortId], 'number') ?? data.chunkSize;
			chunkSize = chunkSize > 0 ? chunkSize : 1;

			// validate input array
			const invalidGraphInputs = inputArray.some((f) => typeof f != 'object');
			if (invalidGraphInputs) {
				outputs['results' as PortId] = {
					type: 'control-flow-excluded',
					value: undefined,
				};
				outputs['error' as PortId] = {
					type: 'string',
					value:
						"Input array must be an array of objects.  A graph needs an object with keys that match the graph's input ports",
				};
				return outputs;
			}

			// create a queue to process the array
			const queue = new PQueue({ concurrency: chunkSize });
			const addToQueue = inputArray.map((item: any, index) => {
				return queue.add<Outputs>(async (): Promise<Outputs> => {
					let itemOutput: Outputs = {};
					try {
						// create a call graph node
						const node = rivet.callGraphNode.impl.create();
						const impl = rivet.globalRivetNodeRegistry.createDynamicImpl(node);

						// set the inputs
						const itemDatavalue: ObjectDataValue = {
							type: 'object',
							value: item,
						};
						const iteratorInputData: Inputs = {
							['graph' as PortId]: inputData['graph' as PortId],
							['inputs' as PortId]: itemDatavalue,
						};

						// process the graph
						itemOutput = await impl.process(iteratorInputData, context);
					} catch (err) {
						itemOutput['outputs' as PortId] = {
							type: 'control-flow-excluded',
							value: undefined,
						};

						itemOutput['error' as PortId] = {
							type: 'string',
							value: `There is an error running the graph ${graph.graphName}.  ItemIndex: ${index}.  Inputs: ${item}  ${
								rivet.getError(err).message
							}`,
						};
					}
					return itemOutput;
				}) as Promise<Outputs>;
			});

			// wait for queue to finish
			const results = await Promise.all(addToQueue);
			await queue.onIdle();

			// process results
			outputs['results' as PortId] = {
				type: 'object[]',
				value: results,
			};
			return outputs;
		},
	};

	// Once a node is defined, you must pass it to rivet.pluginNodeDefinition, which will return a valid
	// PluginNodeDefinition object.
	const iteratorPluginNode = rivet.pluginNodeDefinition(IteratorPluginNodeImpl, 'Iterator Plugin Node');

	// This definition should then be used in the `register` function of your plugin definition.
	return iteratorPluginNode;
}
