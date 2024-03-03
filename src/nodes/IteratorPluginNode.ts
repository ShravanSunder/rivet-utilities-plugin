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
} from "@ironclad/rivet-core";

// This defines your new type of node.
export type IteratorPluginNode = ChartNode<
  "iteratorPlugin",
  IteratorPluginNodeData
>;

// This defines the data that your new node will store.
export type IteratorPluginNodeData = {
  inputArray: any[];
};

// Make sure you export functions that take in the Rivet library, so that you do not
// import the entire Rivet core library in your plugin.
export function iteratorPluginNode(rivet: typeof Rivet) {
  // This is your main node implementation. It is an object that implements the PluginNodeImpl interface.
  const IteratorPluginNodeImpl: PluginNodeImpl<IteratorPluginNode> = {
    // This should create a new instance of your node type from scratch.
    create(): IteratorPluginNode {
      const node: IteratorPluginNode = {
        // Use rivet.newId to generate new IDs for your nodes.
        id: rivet.newId<NodeId>(),

        // This is the default data that your node will store
        data: {
          inputArray: [],
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

      if (data.inputArray.length > 0) {
        inputs.push({
          id: "input array" as PortId,
          dataType: "any[]",
          title: "Input array",
        });
      }

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
          id: "item" as PortId,
          dataType: "any",
          title: "Item from input array",
        },
        {
          id: "itemIndex" as PortId,
          dataType: "number",
          title: "Index of item",
        },
        {
          id: "arrayLength" as PortId,
          dataType: "number",
          title: "Length of array",
        }
      ];
    },

    // This returns UI information for your node, such as how it appears in the context menu.
    getUIData(): NodeUIData {
      return {
        contextMenuTitle: "Iterator Plugin",
        group: "Iterator",
        infoBoxBody: "This is an iterator plugin node.",
        infoBoxTitle: "Iterator Plugin Node",
      };
    },

    // This function defines all editors that appear when you edit your node.
    getEditors(
      _data: IteratorPluginNodeData
    ): EditorDefinition<IteratorPluginNode>[] {
      return [
      ];
    },

    // This function returns the body of the node when it is rendered on the graph. You should show
    // what the current data of the node is in some way that is useful at a glance.
    getBody(
      data: IteratorPluginNodeData
    ): string | NodeBodySpec | NodeBodySpec[] | undefined {
      return rivet.dedent`
        Iterator Plugin Node
        Data: ${data.inputArray ? "(Using Input)" : data.inputArray}
      `;
    },

    // This is the main processing function for your node. It can do whatever you like, but it must return
    // a valid Outputs object, which is a map of port IDs to DataValue objects. The return value of this function
    // must also correspond to the output definitions you defined in the getOutputDefinitions function.
    async process(
      data: IteratorPluginNodeData,
      inputData: Inputs,
      _context: InternalProcessContext
    ): Promise<Outputs> {
      const inputArray = rivet.getInputOrData(
        data,
        inputData,
        "inputArray",
        "any[]"
      );

      return {
        ["item" as PortId]: {
          type: "any",
          value: inputArray,
        },
        ["itemIndex" as PortId]: {
          type: "number",
          value: 0,
        },
        ["arrayLength" as PortId]: {
          type: "number",
          value: inputArray.length,
        }
      };
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
