// src/nodes/IteratorPluginNode.ts
function iteratorPluginNode(rivet) {
  const IteratorPluginNodeImpl = {
    // This should create a new instance of your node type from scratch.
    create() {
      const id = rivet.newId();
      const node = {
        // Use rivet.newId to generate new IDs for your nodes.
        id,
        // This is the default data that your node will store
        data: {
          inputArray: [],
          chunkSize: 1,
          accumulator: [],
          currentIndex: 0
        },
        // This is the default title of your node.
        title: "Iterator Plugin Node",
        // This must match the type of your node.
        type: "iteratorPlugin",
        // X and Y should be set to 0. Width should be set to a reasonable number so there is no overflow.
        visualData: {
          x: 0,
          y: 0,
          width: 200
        }
      };
      return node;
    },
    // This function should return all input ports for your node, given its data, connections, all other nodes, and the project. The
    // connection, nodes, and project are for advanced use-cases and can usually be ignored.
    getInputDefinitions(data, _connections, _nodes, _project) {
      const inputs = [];
      if (data.inputArray.length > 0) {
        inputs.push({
          id: "input array",
          dataType: "any[]",
          title: "Input array"
        });
      }
      if (data.chunkSize > 0) {
        inputs.push({
          id: "chunkSize",
          dataType: "number",
          title: "Chunk Size"
        });
      }
      inputs.push({
        id: "accumulator",
        dataType: "any[]",
        title: "Result Array"
      });
      return inputs;
    },
    // This function should return all output ports for your node, given its data, connections, all other nodes, and the project. The
    // connection, nodes, and project are for advanced use-cases and can usually be ignored.
    getOutputDefinitions(_data, _connections, _nodes, _project) {
      return [
        {
          id: "chunk",
          dataType: "any[]",
          title: "Item Chunk from input array"
        },
        {
          id: "chunkStartingIndex",
          dataType: "number",
          title: "Index of chunk[0]"
        },
        {
          id: "arrayLength",
          dataType: "number",
          title: "Length of array"
        },
        {
          id: "finalResults",
          dataType: "any[]",
          title: "Iterator Done Result Array"
        }
      ];
    },
    // This returns UI information for your node, such as how it appears in the context menu.
    getUIData() {
      return {
        contextMenuTitle: "Iterator Plugin",
        group: "Iterator",
        infoBoxBody: "This is an iterator plugin node.",
        infoBoxTitle: "Iterator Plugin Node"
      };
    },
    // This function defines all editors that appear when you edit your node.
    getEditors(_data) {
      return [
        {
          type: "number",
          dataKey: "chunkSize",
          label: "Chunk Size",
          defaultValue: 1
        }
      ];
    },
    // This function returns the body of the node when it is rendered on the graph. You should show
    // what the current data of the node is in some way that is useful at a glance.
    getBody(data) {
      return rivet.dedent`
        Iterator Plugin Node
        Data: ${data.inputArray ? "(Using Input)" : data.inputArray}
      `;
    },
    // This is the main processing function for your node. It can do whatever you like, but it must return
    // a valid Outputs object, which is a map of port IDs to DataValue objects. The return value of this function
    // must also correspond to the output definitions you defined in the getOutputDefinitions function.
    async process(data, inputData, _context) {
      const outputs = {};
      const inputArray = rivet.getInputOrData(data, inputData, "inputArray", "any[]");
      const chunkSize = rivet.getInputOrData(data, inputData, "chunkSize", "number");
      outputs[`arrayLength`] = { type: "number", value: inputArray.length };
      outputs[`chunk`] = { type: "control-flow-excluded[]", value: [] };
      outputs[`chunkStartingIndex`] = { type: "number", value: -1 };
      const accumulatorDataValue = inputData["accumulator"];
      if (accumulatorDataValue.type === "control-flow-excluded" || accumulatorDataValue.type === "control-flow-excluded[]") {
        return outputs;
      }
      const accumulator = rivet.getInputOrData(data, inputData, "accumulator", "any[]") ?? [];
      outputs[`accumulator`] = { type: "any[]", value: accumulator };
      const totalChunks = Math.ceil(inputArray.length / chunkSize);
      if (data.currentIndex >= totalChunks) {
        outputs[`finalResults`] = { type: "any[]", value: accumulator };
        return outputs;
      } else {
        for (let chunkIndex = data.currentIndex; chunkIndex < totalChunks; chunkIndex++) {
          const start = chunkIndex * chunkSize;
          const end = start + chunkSize;
          const chunk = inputArray.slice(start, end);
          outputs[`chunk`] = { type: "any[]", value: chunk };
          outputs[`chunkStartingIndex`] = { type: "number", value: start };
          outputs[`finalResults`] = { type: "control-flow-excluded", value: "loop-not-broken" };
        }
        data.currentIndex = data.currentIndex + chunkSize;
        return outputs;
      }
    }
  };
  const iteratorPluginNode2 = rivet.pluginNodeDefinition(IteratorPluginNodeImpl, "Iterator Plugin Node");
  return iteratorPluginNode2;
}

// src/index.ts
var plugin = (rivet) => {
  const utilitiesNode = iteratorPluginNode(rivet);
  const utilitiesPlugin = {
    // The ID of your plugin should be unique across all plugins.
    id: "utilities-plugin",
    // The name of the plugin is what is displayed in the Rivet UI.
    name: "Utilities Plugin",
    // Define all configuration settings in the configSpec object.
    configSpec: {
      utilitiesSetting: {
        type: "string",
        label: "Utilities Setting",
        description: "This is an utilities setting for the utilities plugin.",
        helperText: "This is an utilities setting for the utilities plugin."
      }
    },
    // Define any additional context menu groups your plugin adds here.
    contextMenuGroups: [
      {
        id: "utilities",
        label: "Utilities"
      }
    ],
    // Register any additional nodes your plugin adds here. This is passed a `register`
    // function, which you can use to register your nodes.
    register: (register) => {
      register(utilitiesNode);
    }
  };
  return utilitiesPlugin;
};
var src_default = plugin;
export {
  src_default as default
};
