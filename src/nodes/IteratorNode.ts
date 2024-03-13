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
import PQueue from 'p-queue';

import nodeImage from '../../public/iterator plugin info.png';
import { createDigest } from '../helpers/createDigest';
import { decompressObject, compressObject } from '../helpers/lzObject';
import { configKeys } from '../models/config';

const callGraphConnectionIds = {
	graph: 'graph' as PortId,
	inputs: 'inputs' as PortId,
	outputs: 'outputs' as PortId,
	error: 'error' as PortId,
} as const;

const iteratorConnectionIds = {
	iteratorInputs: 'iteratorInputs' as PortId,
	iteratorOutputs: 'iteratorOutputs' as PortId,
	graph: 'graph' as PortId,
	chunkSize: 'chunkSize' as PortId,
	error: 'error' as PortId,
	hasCache: 'hasCache' as PortId,
} as const;

// This defines your new type of node.
export type IteratorNode = ChartNode<'iteratorNode', IteratorNodeData>;

// This defines the data that your new node will store.
export type IteratorNodeData = {
	iteratorOutputs: {
		outputs: ObjectDataValue;
	}[];
	chunkSize: number;
	hasCache: boolean;
	useChunkSizeToggle: boolean;
};

/**
 * The id is the graphId associated with the call graph
 */
const iteratorCacheStorage: Map<
	string,
	{
		/**
		 * Compressed Objects are stored
		 */
		cache: Map<string, string>;
		expiryTimestamp: number;
		/**
		 * Create a graphSnapshot sowe can invalidate cache
		 */
		graphSnapshot?: string;
	}
> = new Map();

// Make sure you export functions that take in the Rivet library, so that you do not
// import the entire Rivet core library in your plugin.
export function createIteratorNode(rivet: typeof Rivet) {
	const iteratorInputOutputsHelperMessage = rivet.dedent`Inputs must be an array of objects to iterate over.  Each object in the array should be a ObjectDataValue \`{type: 'object', value: <graph inputs>}\`; where <graph inputs> is of the format \`{type: 'object', value: {<graph input id>: <input value>}}\` The graph input id should match the graph's input ports.  The input value should be a DataValue. 

  Ouputs will be an array of ObjectDataValue \`type: 'object', value: {<graph output id>: <output value>}\``;

	/**************
	 * Plugin Code
	 */
	// This is your main node implementation. It is an object that implements the PluginNodeImpl interface.
	const IteratorNodeImpl: PluginNodeImpl<IteratorNode> = {
		// This should create a new instance of your node type from scratch.
		create(): IteratorNode {
			const id = rivet.newId<NodeId>();
			const node: IteratorNode = {
				// Use rivet.newId to generate new IDs for your nodes.
				id,

				// This is the default data that your node will store
				data: {
					iteratorOutputs: [],
					chunkSize: 1,
					useChunkSizeToggle: false,
					hasCache: false,
				} satisfies IteratorNodeData,

				// This is the default title of your node.
				title: 'Iterator Node',

				// This must match the type of your node.
				type: 'iteratorNode',

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
			data: IteratorNodeData,
			_connections: NodeConnection[],
			_nodes: Record<NodeId, ChartNode>,
			_project: Project
		): NodeInputDefinition[] {
			const inputs: NodeInputDefinition[] = [];

			inputs.push({
				id: iteratorConnectionIds.graph,
				dataType: 'graph-reference',
				title: 'Graph',
				description: 'The reference to the graph to call.',
				required: true,
			});

			inputs.push({
				id: iteratorConnectionIds.iteratorInputs,
				dataType: 'object[]',
				title: 'Iterator Inputs Array',
				description: iteratorInputOutputsHelperMessage,
				required: true,
			});

			if (data.useChunkSizeToggle) {
				inputs.push({
					id: iteratorConnectionIds.chunkSize,
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
			data: IteratorNodeData,
			_connections: NodeConnection[],
			_nodes: Record<NodeId, ChartNode>,
			_project: Project
		): NodeOutputDefinition[] {
			return [
				{
					id: iteratorConnectionIds.iteratorOutputs,
					dataType: 'object[]',
					title: 'Iterator Output Array',
				},
			];
		},

		// This returns UI information for your node, such as how it appears in the context menu.
		getUIData(): NodeUIData {
			return {
				contextMenuTitle: 'Iterator Node',
				group: 'Logic',
				infoBoxBody: rivet.dedent`This is an iterator node.  This node will map over an array and process each item with the graph provided. 
          
          ${iteratorInputOutputsHelperMessage}`,
				infoBoxTitle: 'Iterator Node',
				infoBoxImageUri: nodeImage,
			};
		},

		// This function defines all editors that appear when you edit your node.
		getEditors(_data: IteratorNodeData): EditorDefinition<IteratorNode>[] {
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
				{
					type: 'toggle',
					dataKey: 'hasCache',
					label: 'Cache Execution',
					helperMessage: rivet.dedent`If true, the node will cache the successful results of the previous call graph executions. It will use the cached results for the same item inputs.`,
				},
			];
		},

		// This function returns the body of the node when it is rendered on the graph. You should show
		// what the current data of the node is in some way that is useful at a glance.
		getBody(data: IteratorNodeData): string | NodeBodySpec | NodeBodySpec[] | undefined {
			return rivet.dedent`
        Iterator Node
        IteratorOutputs: ${data.iteratorOutputs ?? []}
      `;
		},

		// This is the main processing function for your node. It can do whatever you like, but it must return
		// a valid Outputs object, which is a map of port IDs to DataValue objects. The return value of this function
		// must also correspond to the output definitions you defined in the getOutputDefinitions function.
		async process(data: IteratorNodeData, inputData: Inputs, context: InternalProcessContext): Promise<Outputs> {
			const outputs: Outputs = {};

			let abortIteration = false;
			context.signal.addEventListener('abort', () => {
				abortIteration = true;
			});

			// get the inputs
			const graphRef = rivet.coerceType(inputData[iteratorConnectionIds.graph], 'graph-reference');
			const iteratorInputs = rivet.coerceType(inputData[iteratorConnectionIds.iteratorInputs], 'object[]');
			let chunkSize = rivet.coerceTypeOptional(inputData[iteratorConnectionIds.chunkSize], 'number') ?? data.chunkSize;
			chunkSize = chunkSize > 0 ? chunkSize : 1;

			/**
			 * validate input array, they should all be objects
			 */
			const allItemsAreObjects = iteratorInputs.some((s) => typeof s !== 'object');
			if (allItemsAreObjects) {
				outputs[iteratorConnectionIds.iteratorOutputs] = {
					type: 'control-flow-excluded',
					value: undefined,
				};
				outputs[iteratorConnectionIds.error] = {
					type: 'string',
					value: rivet.dedent`Input array must be an array of objects.  Each object needs to be a DataValue.  A graph needs an object with keys that match the graph's input ports`,
				};
				return outputs;
			}

			/**
			 * get the graph
			 */
			const graph = context.project.graphs[graphRef.graphId];
			const graphSnapshot = await createDigest(JSON.stringify(graph.nodes.map((m) => m.data)));
			const cacheId = graphRef.graphId as string;
			console.log('iterator', { data, cacheId, iteratorCacheStorage });
			const hasCache = data.hasCache && cacheId != null;
			/**
			 * cache storage
			 */
			const cacheStorage = iteratorCacheStorage.get(cacheId) ?? {
				cache: new Map<string, string>(),
				expiryTimestamp: Date.now() + 1 * 60 * 60 * 1000 /** 1 hour */,
				graphSnapshot,
			};
			invalideCacheIfChanges(cacheStorage, graphSnapshot);

			// validate input items to make sure they have all  keys of the  graph's input ports
			const missingKeys = new Set<string>();
			const notDataValue = new Set<string>();
			const invalidInputs = iteratorInputs.some((s) => {
				return validateInputItem(s, graph, missingKeys, notDataValue);
			});
			// console.log("iterator", "invalidInputs", { invalidInputs });
			if (invalidInputs) {
				outputs[iteratorConnectionIds.iteratorOutputs] = {
					type: 'control-flow-excluded',
					value: undefined,
				};
				let errorMessage = 'Input validation error::';
				if (missingKeys.size > 0) {
					errorMessage += `Missing keys required for graph: 
            ${Array.from(missingKeys)
							.map((key) => key)
							.join('; ')}`;
				}
				if (notDataValue.size > 0) {
					errorMessage += rivet.dedent`Invalid Inputs, make sure each input item is a ObjectDataValue: 
            ${Array.from(notDataValue)
							.map((value) => JSON.stringify(value))
							.join('; ')}`;
				}
				outputs[iteratorConnectionIds.error] = {
					type: 'string',
					value: errorMessage,
				};
				return outputs;
			}

			// create a queue to process the array
			const queue = new PQueue({ concurrency: chunkSize });
			const addToQueue = iteratorInputs.map((item: unknown, index) => {
				return queue.add<Outputs>(async (): Promise<Outputs> => {
					let itemOutput: Outputs = {};
					try {
						if (!abortIteration) {
							// create a call graph node
							const node = rivet.callGraphNode.impl.create();
							const impl = rivet.globalRivetNodeRegistry.createDynamicImpl(node);

							// set the inputs
							let itemDataValue: ObjectDataValue = {
								type: 'object',
								value: item as Record<string, unknown>,
							};
							if (isObjectDataValue(item)) {
								itemDataValue = item;
							}

							const iteratorInputData: Inputs = {
								[callGraphConnectionIds.graph]: inputData[iteratorConnectionIds.graph],
								[callGraphConnectionIds.inputs]: itemDataValue,
							};

							if (hasCache) {
								const cacheKey = await createDigest(JSON.stringify(iteratorInputData));
								const cachedOutputCompressed = cacheStorage.cache.get(cacheKey);
								if (cachedOutputCompressed) {
									console.log('iterator', 'get cache', {
										cacheKey,
										itemDataValue,
										cachedOutputCompressed,
										iteratorCacheStorage,
									});
									return decompressObject<Outputs>(cachedOutputCompressed);
								}
							}
							itemOutput = await impl.process(iteratorInputData, context);

							if (hasCache) {
								const cacheKey = await createDigest(JSON.stringify(iteratorInputData));
								console.log('iterator', 'set cache', {
									cacheKey,
									itemOutput,
									itemDataValue,
									iteratorCacheStorage,
								});
								cacheStorage.cache.set(cacheKey, compressObject(itemOutput));
							}
						} else {
							/**
							 * If aborted
							 */
							itemOutput[callGraphConnectionIds.outputs] = {
								type: 'control-flow-excluded',
								value: undefined,
							};
							itemOutput[callGraphConnectionIds.error] = {
								type: 'string',
								value: `Aborted ${graphRef.graphName}`,
							};
						}
					} catch (err) {
						itemOutput[callGraphConnectionIds.outputs] = {
							type: 'control-flow-excluded',
							value: undefined,
						};

						itemOutput[callGraphConnectionIds.error] = {
							type: 'string',
							value: `Error running graph ${graphRef.graphName}.  Inputs: ${JSON.stringify(item)}  Message: ${
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
				console.log('iterator', 'set cacheStorage', {
					cacheId,
					cacheStorage,
				});
				iteratorCacheStorage.set(cacheId, cacheStorage);
				void cleanExpiredCache();
			}

			const errorInIteratorOutputs = iteratorOutputs.some(
				(f) => f[callGraphConnectionIds.outputs]?.type === 'control-flow-excluded'
			);
			if (errorInIteratorOutputs) {
				outputs[iteratorConnectionIds.iteratorOutputs] = {
					type: 'control-flow-excluded',
					value: undefined,
				};
				outputs[iteratorConnectionIds.error] = {
					type: 'string',
					value: iteratorOutputs
						.filter((f) => f[callGraphConnectionIds.outputs]?.type === 'control-flow-excluded')
						.map((m, i) => `ItemIndex:${i}:: ${m[callGraphConnectionIds.error]?.value}`)
						.join(';\n  '),
				};
				return outputs;
			}

			// process iteratorOutputs
			outputs[iteratorConnectionIds.iteratorOutputs] = {
				type: 'object[]',
				value: iteratorOutputs,
			};
			return outputs;
		},
	};

	/******************************************
	 * Helper Functions
	 */
	/**
	 * Checks if the data is a DataValue
	 * @param data
	 * @returns
	 */

	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	const isAnyDataValue = (data: any): data is { type: string; value: any } => {
		return (
			typeof data === 'object' &&
			'type' in data &&
			'value' in data &&
			(rivet.isScalarDataType(data.type) || rivet.isArrayDataType(data.type) || rivet.isFunctionDataType(data.type))
		);
	};
	/**
	 * Checks if the data is a ObjectDataValue
	 * @param data
	 * @returns
	 */

	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	const isObjectDataValue = (data: any): data is ObjectDataValue => {
		return typeof data === 'object' && data?.type === 'object' && typeof data?.value === 'object';
	};

	const invalideCacheIfChanges = (
		cacheStorage: {
			cache: Map<string, string>;
			expiryTimestamp: number;
			/**
			 * Create a graphSnapshot sowe can invalidate cache
			 */
			graphSnapshot?: string | undefined;
		},
		graphSnapshot: string
	) => {
		if (cacheStorage.graphSnapshot !== graphSnapshot) {
			console.log('iterator', 'invalidate cache', {
				cacheStorage,
				graphSnapshot,
			});
			cacheStorage.cache.clear();
			cacheStorage.graphSnapshot = graphSnapshot;
		}
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
			itemValues = Object.values(item.value);
		}

		/**
		 * expected keys are the ids of the graph's input nodes, if they exist
		 */

		const graphInputNodes = graph.nodes.filter((f) => f.type === 'graphInput');
		const expectedKeys = graphInputNodes
			.map((m) => {
				const id = (m.data as Record<string, unknown>).id as string;
				return id ?? null;
			})
			.filter((f) => f != null);

		/**
		 * if expected keys aren't in the item keys, then the item is invalid
		 */
		if (expectedKeys.some((s) => !itemKeys.includes(s))) {
			for (const key of expectedKeys) {
				if (!itemKeys.includes(key)) {
					missingKeys.add(key);
				}
			}
			return true;
		}

		const invalidData = itemValues.some((s: unknown) => {
			/**
			 * if the item values aren't DataValues, then the item is invalid
			 */
			const isDataType = isAnyDataValue(s);
			if (!isDataType) {
				/**
				 * save the key that isn't a DataValue
				 */
				notDataValue.add(s as string);
				return true;
			}
		});
		return invalidData;
	};

	const cleanExpiredCache = async (): Promise<void> => {
		const now = Date.now();
		iteratorCacheStorage.forEach((value, key) => {
			if (value.expiryTimestamp < now) {
				console.log('iterator', 'delete cache', {
					key,
					value,
				});
				iteratorCacheStorage.delete(key);
			}
		});
	};

	// Once a node is defined, you must pass it to rivet.pluginNodeDefinition, which will return a valid
	// PluginNodeDefinition object.
	const iteratorNode = rivet.pluginNodeDefinition(IteratorNodeImpl, 'Iterator Node');

	// This definition should then be used in the `register` function of your plugin definition.
	return iteratorNode;
}
