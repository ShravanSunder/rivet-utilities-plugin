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
} from "@ironclad/rivet-core";
import PQueue from "p-queue";

import nodeImage from "../../public/iterator plugin info.png";

// This defines your new type of node.
export type IteratorPluginNode = ChartNode<
  "iteratorPlugin",
  IteratorPluginNodeData
>;

// This defines the data that your new node will store.
export type IteratorPluginNodeData = {
  results: any[];
  chunkSize: number;
  useChunkSizeToggle: boolean;
};

// Make sure you export functions that take in the Rivet library, so that you do not
// import the entire Rivet core library in your plugin.
export function iteratorPluginNode(rivet: typeof Rivet) {
  const isAnyDataValue = (data: any): data is { type: string; value: any } => {
    return (
      typeof data == "object" &&
      "type" in data &&
      "value" in data &&
      (rivet.isScalarDataType(data.type) ||
        rivet.isArrayDataType(data.type) ||
        rivet.isFunctionDataType(data.type))
    );
  };
  const isObjectDataValue = (data: any): data is ObjectDataValue => {
    return typeof data =="object" && data?.type == "object" && typeof data?.value == "object";
  };

  const validateInputItem = (
    item: Record<string, unknown>,
    graph: NodeGraph,
    missingKeys: Set<string>,
    notDataValue: Set<string>
  ) => {
    let itemProvidedKeys = Object.keys(item);
    if (isObjectDataValue(item)) {
      itemProvidedKeys = Object.keys(item.value);
    }

    console.log("iterator", "validateInputItem", { itemProvidedKeys });

    /**
     * expected keys are the ids of the graph's input nodes, if they exist
     */

    const graphInputNodes = graph.nodes.filter((f) => f.type == "graphInput");
    const expectedKeys = graphInputNodes
      .map((m) => {
        const id = (m.data as Record<string, unknown>)["id"] as string;
        return id ?? null;
      })
      .filter((f) => f != null);

    /**
     * if expected keys aren't in the item keys, then the item is invalid
     */
    if (expectedKeys.some((s) => !itemProvidedKeys.includes(s))) {
      expectedKeys
        .filter((key) => !itemProvidedKeys.includes(key))
        .forEach((key) => missingKeys.add(key));
      return true;
    }

    const itemValues = Object.values(item);
    const invalidData = itemValues.some((s: any) => {
      /**
       * if the item values aren't DataValues, then the item is invalid
       */
      const isDataType = isAnyDataValue(s);
      if (!isDataType) {
        /**
         * save the key that isn't a DataValue
         */
        notDataValue.add(s);
        return true;
      }
    });
    return invalidData;
  };

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
        id: "inputsArray" as PortId,
        dataType: "object[]",
        title: "Input Array",
        description:
          "The array to iterate over.  This should be an array of objects.  Each object should be a DataValue.  The graph needs an object with keys that match the graph's input ports.",
        required: true,
      });

      if (data.useChunkSizeToggle) {
        inputs.push({
          id: "chunkSize" as PortId,
          dataType: "number",
          title: "Chunk Size",
          description:
            "The concurrency limit: The number of items to process at the same time.",
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
          id: "results" as PortId,
          dataType: "object[]",
          title: "Iterator Results",
        },
      ];
    },

    // This returns UI information for your node, such as how it appears in the context menu.
    getUIData(): NodeUIData {
      return {
        contextMenuTitle: "Iterator Plugin",
        group: "Logic",
        infoBoxBody:
          "This is an iterator plugin node.  This node will map over an array and process each item with the graph provided.",
        infoBoxTitle: "Iterator Plugin Node",
        infoBoxImageUri: nodeImage,
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
          label: "Chunk size",
          defaultValue: 1,
          helperMessage:
            "The number of items to process at the same time.  This will help process arrays quickly while not overloading the system.  Recommended to keep this below 10 for subgraphs that make network calls or stream model responses.",
          useInputToggleDataKey: "useChunkSizeToggle",
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
        Results: ${data.results}
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
      const outputs: Outputs = {};

      // get the inputs
      const graphRef = rivet.coerceType(
        inputData["graph" as PortId],
        "graph-reference"
      );
      const inputsArray = rivet.coerceType(
        inputData["inputsArray" as PortId],
        "object[]"
      );
      let chunkSize =
        rivet.coerceTypeOptional(inputData["chunkSize" as PortId], "number") ??
        data.chunkSize;
      chunkSize = chunkSize > 0 ? chunkSize : 1;

      // validate input array, they should all be objects
      const allItemsAreObjects = inputsArray.some((s) => typeof s != "object");
      if (allItemsAreObjects) {
        outputs["results" as PortId] = {
          type: "control-flow-excluded",
          value: undefined,
        };
        outputs["error" as PortId] = {
          type: "string",
          value:
            "Input array must be an array of objects.  Each object needs to be a DataValue.  A graph needs an object with keys that match the graph's input ports",
        };
        return outputs;
      }

      console.log("iterator", "inputData", { inputData });

      const graph = context.project.graphs[graphRef.graphId];

      // validate input items to make sure they have all  keys of the  graph's input ports
      const missingKeys = new Set<string>();
      const notDataValue = new Set<string>();
      const invalidInputs = inputsArray.some((s) =>
      {
        console.log("iterator", "validateInputItem", { s, graph, missingKeys, notDataValue })
        return validateInputItem(s, graph, missingKeys, notDataValue)
      }
      );
      console.log("iterator", "invalidInputs", { invalidInputs });
      if (invalidInputs) {
        outputs["results" as PortId] = {
          type: "control-flow-excluded",
          value: undefined,
        };
        outputs["error" as PortId] = {
          type: "string",
          value:
            "Input validation error: The input array must have objects with keys that match the graph's input ports.  This should be an array of objects. Each object should be a DataValue;; Missing keys: " +
            Array.from(missingKeys)
              .map((key) => `'${key}'`)
              .join("; ") +
            ";; Invalid DataValues: " +
            Array.from(notDataValue)
              .map((value) => `'${JSON.stringify(value)}'`)
              .join("; "),
        };
        return outputs;
      }

      let abort = false;
      // create a queue to process the array
      const queue = new PQueue({ concurrency: chunkSize });
      const addToQueue = inputsArray.map((item: any, index) => {
        return queue.add<Outputs>(async (): Promise<Outputs> => {
          let itemOutput: Outputs = {};
          try {
            if (!abort) {
              // create a call graph node
              const node = rivet.callGraphNode.impl.create();
              const impl =
                rivet.globalRivetNodeRegistry.createDynamicImpl(node);

              // set the inputs
              let itemDataValue: ObjectDataValue = {
                type: "object",
                value: item,
              };
              if (isObjectDataValue(item)) {
                itemDataValue = item;
              }

              const iteratorInputData: Inputs = {
                ["graph" as PortId]: inputData["graph" as PortId],
                ["inputs" as PortId]: itemDataValue,
              };

              console.log("iterator itemdatavalue", { itemDataValue });

              // process the graph
              itemOutput = await impl.process(iteratorInputData, context);
            } else {
              itemOutput["outputs" as PortId] = {
                type: "control-flow-excluded",
                value: undefined,
              };
            }
          } catch (err) {
            itemOutput["outputs" as PortId] = {
              type: "control-flow-excluded",
              value: undefined,
            };

            itemOutput["error" as PortId] = {
              type: "string",
              value: `Error running graph ${
                graphRef.graphName
              }.  ItemIndex: ${index}.  Inputs: ${item}  ${
                rivet.getError(err).message
              }`,
            };
            abort = true;
          }
          return itemOutput;
        }) as Promise<Outputs>;
      });

      // wait for queue to finish
      const results = await Promise.all(addToQueue);
      await queue.onIdle();

      const errorInResults = results.some(
        (f) => f["outputs" as PortId]?.type == "control-flow-excluded"
      );
      if (errorInResults) {
        outputs["results" as PortId] = {
          type: "control-flow-excluded",
          value: undefined,
        };
        outputs["error" as PortId] = {
          type: "string",
          value: "Error processing items.",
        };
        outputs["outputs" as PortId] = {
          type: "object[]",
          value: results,
        };
        return outputs;
      }

      // process results
      outputs["results" as PortId] = {
        type: "object[]",
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
