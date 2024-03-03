// **** IMPORTANT ****
// Make sure you do `import type` and do not pull in the entire Rivet core library here.
// Export a function that takes in a Rivet object, and you can access rivet library functionality
// from there.
import type {
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
} from '@ironclad/rivet-core';

// This defines your new type of node.
export type IteratorPluginNode = ChartNode<'iteratorPlugin', IteratorPluginNodeData>;

// This defines the data that your new node will store.
export type IteratorPluginNodeData = {
	inputArray: any[];
	chunkSize: number;
	accumulator: any[];
  currentIndex: number;
};

type InputKeys = keyof IteratorPluginNodeData;
type OutputKeys = 'chunk' | 'chunkStartingIndex' | 'chunkSize' | 'arrayLength' | 'finalResults' | 'accumulator';

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
					inputArray: [],
					chunkSize: 1,
					accumulator: [],
          currentIndex: 0,
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

			if (data.inputArray.length > 0) {
				inputs.push({
					id: 'input array' as PortId,
					dataType: 'any[]',
					title: 'Input array',
				});
			}

			if (data.chunkSize > 0) {
				inputs.push({
					id: 'chunkSize' as PortId,
					dataType: 'number',
					title: 'Chunk Size',
				});
			}

			inputs.push({
				id: 'accumulator' as PortId,
				dataType: 'any[]',
				title: 'Result Array',
			});

			return inputs;
		},

		// This function should return all output ports for your node, given its data, connections, all other nodes, and the project. The
		// connection, nodes, and project are for advanced use-cases and can usually be ignored.
		getOutputDefinitions(
			_data: IteratorPluginNodeData,
			_connections: NodeConnection[],
			_nodes: Record<NodeId, ChartNode>,
			_project: Project
		): NodeOutputDefinition[] {
			return [
				{
					id: 'chunk' as PortId,
					dataType: 'any[]',
					title: 'Item Chunk from input array',
				},
				{
					id: 'chunkStartingIndex' as PortId,
					dataType: 'number',
					title: 'Index of chunk[0]',
				},
				{
					id: 'arrayLength' as PortId,
					dataType: 'number',
					title: 'Length of array',
				},
				{
					id: 'finalResults' as PortId,
					dataType: 'any[]',
					title: 'Iterator Done Result Array',
				},
			];
		},

		// This returns UI information for your node, such as how it appears in the context menu.
		getUIData(): NodeUIData {
			return {
				contextMenuTitle: 'Iterator Plugin',
				group: 'Iterator',
				infoBoxBody: 'This is an iterator plugin node.',
				infoBoxTitle: 'Iterator Plugin Node',
			};
		},

		// This function defines all editors that appear when you edit your node.
		getEditors(_data: IteratorPluginNodeData): EditorDefinition<IteratorPluginNode>[] {
			return [
				{
					type: 'number',
					dataKey: 'chunkSize',
					label: 'Chunk Size',
					defaultValue: 1,
				},
			];
		},

		// This function returns the body of the node when it is rendered on the graph. You should show
		// what the current data of the node is in some way that is useful at a glance.
		getBody(data: IteratorPluginNodeData): string | NodeBodySpec | NodeBodySpec[] | undefined {
			return rivet.dedent`
        Iterator Plugin Node
        Data: ${data.inputArray ? '(Using Input)' : data.inputArray}
      `;
		},

		// This is the main processing function for your node. It can do whatever you like, but it must return
		// a valid Outputs object, which is a map of port IDs to DataValue objects. The return value of this function
		// must also correspond to the output definitions you defined in the getOutputDefinitions function.
		async process(data: IteratorPluginNodeData, inputData: Inputs, _context: InternalProcessContext): Promise<Outputs> {
			const outputs: Outputs = {};

			const inputArray = rivet.getInputOrData(data, inputData, 'inputArray', 'any[]');
			const chunkSize = rivet.getInputOrData(data, inputData, 'chunkSize', 'number');

      // set default values for the outputs
			outputs[`arrayLength` satisfies OutputKeys as PortId] = { type: 'number', value: inputArray.length };
			outputs[`chunk`satisfies OutputKeys as PortId] = { type: 'control-flow-excluded[]', value: [] };
			outputs[`chunkStartingIndex` satisfies OutputKeys as PortId] = { type: 'number', value: -1 };

      const accumulatorDataValue = inputData['accumulator' satisfies OutputKeys as PortId]!;
			if (
				accumulatorDataValue.type === 'control-flow-excluded' ||
				accumulatorDataValue.type === 'control-flow-excluded[]'
			) {
        // there was an signal to stop, so the loop should stop
				return outputs;
			}

			const accumulator = rivet.getInputOrData(data, inputData, 'accumulator', 'any[]') ?? [];
      outputs[`accumulator` as PortId] = { type: 'any[]', value: accumulator };

      const totalChunks = Math.ceil(inputArray.length / chunkSize);
			if (data.currentIndex >= totalChunks) {
				// If we have processed all the chunks, we are done
				outputs[`finalResults` satisfies OutputKeys as PortId] = { type: 'any[]', value: accumulator };
				return outputs;
			} else {
				// We are not done, so we need to process the next chunk
				for (let chunkIndex = data.currentIndex; chunkIndex < totalChunks; chunkIndex++) {
					const start = chunkIndex * chunkSize;
					const end = start + chunkSize;
					const chunk = inputArray.slice(start, end);

					outputs[`chunk` satisfies OutputKeys as PortId] = { type: 'any[]', value: chunk };
					outputs[`chunkStartingIndex` satisfies OutputKeys as PortId] = { type: 'number', value: start };
          outputs[`finalResults` satisfies OutputKeys as PortId] = { type: 'control-flow-excluded', value: 'loop-not-broken' };
				}
				data.currentIndex = data.currentIndex + chunkSize;
				return outputs;
			}
		},
	};

	// Once a node is defined, you must pass it to rivet.pluginNodeDefinition, which will return a valid
	// PluginNodeDefinition object.
	const iteratorPluginNode = rivet.pluginNodeDefinition(IteratorPluginNodeImpl, 'Iterator Plugin Node');

	// This definition should then be used in the `register` function of your plugin definition.
	return iteratorPluginNode;
}
