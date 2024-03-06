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
} from "@ironclad/rivet-core";
import PQueue from "p-queue";

import nodeImage from "../../public/iterator plugin info.png";

// This defines your new type of node.
export type IteratorPluginNode = ChartNode<
  "iteratorPlugin",
  IteratorPluginNodeData
  >;

const sha256 = async (input: string) => {
  const buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  const hexHash = Array.from(new Uint8Array(buffer))
  .map(byte => byte.toString(16).padStart(2, '0'))
  .join('');
  return hexHash;
};

// This defines the data that your new node will store.
export type IteratorPluginNodeData = {
  iteratorOutputs: {
    outputs: ObjectDataValue;
  }[];
  chunkSize: number;
  hasCache: boolean;
  useChunkSizeToggle: boolean;
  nodeId: NodeId;
};

const callGraphConnectionIds = {
  graph: "graph" as PortId,
  inputs: "inputs" as PortId,
  outputs: "outputs" as PortId,
  error: "error" as PortId,
} as const;

const iteratorConnectionIds = {
  iteratorInputs: "iteratorInputs" as PortId,
  iteratorOutputs: "iteratorOutputs" as PortId,
  graph: "graph" as PortId,
  chunkSize: "chunkSize" as PortId,
  iteratorError: "error" as PortId,
  hasCache: "hasCache" as PortId,
} as const;

const iteratorInputOutputsHelperMessage = "Inputs must be an array of objects to iterate over.  Each object in the array should be a ObjectDataValue `{type: 'object', value: <graph inputs>}`; where <graph inputs> is of the format `{type: `object`, value: {<graph input id>: <input value>}}` The graph input id should match the graph's input ports.  The input value should be a DataValue. \n\n Ouputs will be an array of ObjectDataValue `type: `object`, value: {<graph output id>: <output value>}`"; ;

// Make sure you export functions that take in the Rivet library, so that you do not
// import the entire Rivet core library in your plugin.
export function iteratorPluginNode(rivet: typeof Rivet) {
  const nodePluginCache: Map<NodeId, { cache: Map<string, Outputs>, expiryTimestamp: number }> = new Map();

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
          iteratorOutputs: [],
          chunkSize: 1,
          useChunkSizeToggle: false,
          hasCache: false,
          nodeId: id
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
        id: iteratorConnectionIds.graph,
        dataType: "graph-reference",
        title: "Graph",
        description: "The reference to the graph to call.",
        required: true,
      });

      inputs.push({
        id: iteratorConnectionIds.iteratorInputs,
        dataType: "object[]",
        title: "Iterator Inputs Array",
        description:
          iteratorInputOutputsHelperMessage,
        required: true,
      });

      if (data.useChunkSizeToggle) {
        inputs.push({
          id: iteratorConnectionIds.chunkSize,
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
          id: iteratorConnectionIds.iteratorOutputs,
          dataType: "object[]",
          title: "Iterator Output Array",
        },
      ];
    },

    // This returns UI information for your node, such as how it appears in the context menu.
    getUIData(): NodeUIData {
      return {
        contextMenuTitle: "Iterator Plugin",
        group: "Logic",
        infoBoxBody:
          "This is an iterator plugin node.  This node will map over an array and process each item with the graph provided. " + "\n \n" + iteratorInputOutputsHelperMessage,
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
        {
          type: "toggle",
          dataKey: "hasCache",
          label: "Cache Execution",
          helperMessage:
            "If true, the node will cache the successful results of the previous call graph executions. It will use the cached results for the same item inputs.",
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
        IteratorOutputs: ${data.iteratorOutputs}
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

      let abortIteration = false;
      context.signal.addEventListener("abort", () => {
        abortIteration = true;
      });
      
      // get the inputs
      const nodeId = data.nodeId;
      const hasCache = data.hasCache;
      const cacheObj = nodePluginCache.get(nodeId) ?? { cache: new Map<string, Outputs>(), expiryTimestamp: Date.now() + 1 * 60 * 60 /** 1 hour */ };
      const graphRef = rivet.coerceType(
        inputData[iteratorConnectionIds.graph],
        "graph-reference"
      );
      const iteratorInputs = rivet.coerceType(
        inputData[iteratorConnectionIds.iteratorInputs],
        "object[]"
      );
      let chunkSize =
        rivet.coerceTypeOptional(
          inputData[iteratorConnectionIds.chunkSize],
          "number"
        ) ?? data.chunkSize;
      chunkSize = chunkSize > 0 ? chunkSize : 1;

      // validate input array, they should all be objects
      const allItemsAreObjects = iteratorInputs.some(
        (s) => typeof s != "object"
      );
      if (allItemsAreObjects) {
        outputs[iteratorConnectionIds.iteratorOutputs] = {
          type: "control-flow-excluded",
          value: undefined,
        };
        outputs[iteratorConnectionIds.iteratorError] = {
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
      const invalidInputs = iteratorInputs.some((s) => {
        console.log("iterator", "validateInputItem", {
          s,
          graph,
          missingKeys,
          notDataValue,
        });
        return validateInputItem(s, graph, missingKeys, notDataValue);
      });
      console.log("iterator", "invalidInputs", { invalidInputs });
      if (invalidInputs) {
        outputs[iteratorConnectionIds.iteratorOutputs] = {
          type: "control-flow-excluded",
          value: undefined,
        };
        let errorMessage = "Input validation error::";
        if (missingKeys.size > 0) {
          errorMessage += " Missing keys required for graph: " + Array.from(missingKeys)
            .map((key) => `'${key}'`)
            .join("; ");
        }
        if (notDataValue.size > 0) {
          errorMessage += " Invalid Inputs, make sure each input item is a ObjectDataValue: " + Array.from(notDataValue)
            .map((value) => `'${JSON.stringify(value)}'`)
            .join("; ");
        }
        outputs[iteratorConnectionIds.iteratorError] = {
          type: "string",
          value: errorMessage,
        };
        return outputs;
      }

      // create a queue to process the array
      const queue = new PQueue({ concurrency: chunkSize });
      const addToQueue = iteratorInputs.map((item: any, index) => {
        return queue.add<Outputs>(async (): Promise<Outputs> => {
          let itemOutput: Outputs = {};
          try {
            if (!abortIteration) {
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
                [callGraphConnectionIds.graph]:
                  inputData[iteratorConnectionIds.graph],
                [callGraphConnectionIds.inputs]: itemDataValue,
              };

              console.log ("iterator", "hasCache", { hasCache });
              if (hasCache) {
                const cacheKey = await sha256(JSON.stringify(iteratorInputData));
                const cachedOutput = cacheObj.cache.get(cacheKey);
                if (cachedOutput) {
                  return cachedOutput;
                }
              }
              else {
                console.log("iterator itemdatavalue", { itemDataValue });
                const itemIteratorOutputs = await impl.process(
                  iteratorInputData,
                  context
                );
                itemOutput = itemIteratorOutputs as Record<string, DataValue>;

                if (hasCache) {
                  const cacheKey = await sha256(JSON.stringify(iteratorInputData));
                  cacheObj.cache.set(cacheKey, itemOutput);
                }
              }
            } else {
              itemOutput[callGraphConnectionIds.outputs] = {
                type: "control-flow-excluded",
                value: undefined,
              };
            }
          } catch (err) {
            itemOutput[callGraphConnectionIds.outputs] = {
              type: "control-flow-excluded",
              value: undefined,
            };

            itemOutput[callGraphConnectionIds.error] = {
              type: "string",
              value: `Error running graph ${
                graphRef.graphName
              }.  ItemIndex: ${index}::  Inputs: ${JSON.stringify(item)}  Message: ${
                rivet.getError(err).message
              }`,
            };
            abortIteration = true;
          }
          return itemOutput;
        }) as Promise<Outputs>;
      });

      // wait for queue to finish
      const iteratorOutputs = await Promise.all(addToQueue);
      await queue.onIdle();

      if (hasCache) {
        void cleanExpiredCache();
      }

      const errorInIteratorOutputs = iteratorOutputs.some(
        (f) => f[callGraphConnectionIds.outputs]?.type == "control-flow-excluded"
      );
      if (errorInIteratorOutputs) {
        outputs[iteratorConnectionIds.iteratorOutputs] = {
          type: "control-flow-excluded",
          value: undefined,
        };
        outputs[iteratorConnectionIds.iteratorError] = {
          type: "string",
          value: iteratorOutputs.filter(f => f[callGraphConnectionIds.outputs]?.type == "control-flow-excluded").map((m, i) => `ItemIndex: ${i}:: ${m[callGraphConnectionIds.error]}`).join("; "),
        };
        return outputs;
      }

      // process iteratorOutputs
      outputs[iteratorConnectionIds.iteratorOutputs] = {
        type: "object[]",
        value: iteratorOutputs,
      };
      return outputs;
    },
  };

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
    return (
      typeof data == "object" &&
      data?.type == "object" &&
      typeof data?.value == "object"
    );
  };

  const validateInputItem = (
    item: Record<string, unknown>,
    graph: NodeGraph,
    missingKeys: Set<string>,
    notDataValue: Set<string>
  ) => {
    let itemKeys = Object.keys(item);
    if (isObjectDataValue(item)) {
      itemKeys = Object.keys(item.value);
    }

    let itemValues = Object.values(item);
    if (isObjectDataValue(item)) {
      console.log("iterator", "is datavalue", { item });
      itemValues = Object.values(item.value);
    }

    console.log("iterator", "validateInputItem", { itemKeys });

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
    if (expectedKeys.some((s) => !itemKeys.includes(s))) {
      expectedKeys
        .filter((key) => !itemKeys.includes(key))
        .forEach((key) => missingKeys.add(key));
      return true;
    }

    const invalidData = itemValues.some((s: any) => {
      console.log("iterator", "validateInputItem", { s });
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

  const cleanExpiredCache = async (): Promise<void> => {
    const now = Date.now();
    nodePluginCache.forEach((value, key) => {
      if (value.expiryTimestamp < now) {
        nodePluginCache.delete(key);
      }
    });
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
