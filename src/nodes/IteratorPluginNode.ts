// **** IMPORTANT ****
// Make sure you do `import type` and do not pull in the entire Rivet core library here.
// Export a function that takes in a Rivet object, and you can access rivet library functionality
// from there.
import {
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
} from "@ironclad/rivet-core";
import PQueue from "p-queue";

// This defines your new type of node.
export type IteratorPluginNode = ChartNode<
  "iteratorPlugin",
  IteratorPluginNodeData
>;

// This defines the data that your new node will store.
export type IteratorPluginNodeData = {
  useErrorOutput?: boolean;
  chunkSize: number;
  results: any[];
  inputArray: any[];
	errors: any[];
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
          chunkSize: 1,
          results: [],
          inputArray: [],
					errors: [],
        },

        // This is the default title of your node.
        title: "Iterator Plugin Node",

        // This must match the type of your node.
        type: "iteratorPlugin",

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
        id: "graph" as PortId,
        dataType: "graph-reference",
        title: "Graph",
        description: "The reference to the graph to call.",
        required: true,
      });

      inputs.push({
        id: "inputArray" as PortId,
        dataType: "object[]",
        title: "Input Array",
        description: "The array to iterate over.",
        required: true,
      });

      if (data.chunkSize > 0) {
        inputs.push({
          id: "chunkSize" as PortId,
          dataType: "number",
          title: "Chunk Size",
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
          id: "outputData" as PortId,
          dataType: "any[]",
          title: "Output Data",
        },
      ];
    },

    // This returns UI information for your node, such as how it appears in the context menu.
    getUIData(): NodeUIData {
      return {
        contextMenuTitle: "Iterator Plugin",
        group: "Logic",
        infoBoxBody: "This is an iterator plugin node.",
        infoBoxTitle: "Iterator Plugin Node",
      };
    },

    // This function defines all editors that appear when you edit your node.
    getEditors(
      _data: IteratorPluginNodeData
    ): EditorDefinition<IteratorPluginNode>[] {
      return [
        {
          type: "number",
          dataKey: "chunkSize",
          label: "Chunk Size",
          defaultValue: 1,
        },
      ];
    },

    // This function returns the body of the node when it is rendered on the graph. You should show
    // what the current data of the node is in some way that is useful at a glance.
    getBody(
      data: IteratorPluginNodeData
    ): string | NodeBodySpec | NodeBodySpec[] | undefined {
      return rivet.dedent`
        Iterator Plugin Node
        Data: ${data.results}
				Errors: ${data.errors}
      `;
    },

    // This is the main processing function for your node. It can do whatever you like, but it must return
    // a valid Outputs object, which is a map of port IDs to DataValue objects. The return value of this function
    // must also correspond to the output definitions you defined in the getOutputDefinitions function.
    async process(
      data: IteratorPluginNodeData,
      inputData: Inputs,
      context: InternalProcessContext
    ): Promise<Outputs> {
      console.log ('iterator ----', 'started', '---------------')
      const outputs: Outputs = {};
      const inputArray = rivet.getInputOrData(
        data,
        inputData,
        "inputArray",
        "any[]"
      );
      let chunkSize = rivet.getInputOrData(
        data,
        inputData,
        "chunkSize",
        "number"
      );

      chunkSize = chunkSize > 0 ? chunkSize : 1;
      const queue = new PQueue({ concurrency: chunkSize });

      console.log('iterator -------', 'start queue');
      console.log('iterator ------', data, {inputArray, chunkSize});

      const addToQueue = inputArray.map((item: any, index) => {
        console.log('iterator------', 'item', item, index, context);
        return queue.add<Outputs>(async (): Promise<Outputs> => {
					let itemOutput: Outputs = {};
          try {
            const node = rivet.callGraphNode.impl.create();
            const impl = rivet.globalRivetNodeRegistry.createDynamicImpl(node);
            itemOutput = await impl.process(item, context);
            console.log('iterator------', 'itemOutput', itemOutput, impl, node);
          } catch (err) {
						itemOutput['outputs' as PortId] = {
							type: 'control-flow-excluded',
							value: undefined,
						};
			
						itemOutput['error' as PortId] = {
							type: 'string',
							value: `ItemIndex: ${index}; `  + rivet.getError(err).message,
            };
            console.log('iterator', err)
					}
					return itemOutput;
        }) as Promise<Outputs>;
      });

      await queue.onIdle();
      const results = await Promise.all(addToQueue);
      console.log('iterator -------', results, 'await queue')
      
			//data.results = results;
			outputs['results' as PortId] = {
				type: 'any[]',
				value: results,
			};
			return outputs;
    },
  };

  // Once a node is defined, you must pass it to rivet.pluginNodeDefinition, which will return a valid
  // PluginNodeDefinition object.
  const iteratorPluginNode = rivet.pluginNodeDefinition(
    IteratorPluginNodeImpl,
    "Iterator Plugin Node"
  );

  // This definition should then be used in the `register` function of your plugin definition.
  return iteratorPluginNode;
}
