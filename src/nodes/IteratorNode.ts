export type {
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
	LooseDataValue,
	DataValue,
	GraphReferenceNode,
	NodeGraph,
} from '@ironclad/rivet-core';
import PQueue from 'p-queue';

import { createDigest } from '../helpers/createDigest.js';
import { isObjectDataValue } from '../helpers/dataValueHelpers.js';
import { validateGraphInput } from './functions/validateGraphInputItem.js';
import {
	getCacheStorageForNamespace,
	cleanExpiredCache,
	getCachedItem,
	setCachedItem,
	createGraphDigest,
} from '../helpers/cacheStorage';
import {
	PortId,
	ChartNode,
	Rivet,
	PluginNodeImpl,
	NodeId,
	NodeConnection,
	Project,
	NodeInputDefinition,
	NodeOutputDefinition,
	NodeUIData,
	EditorDefinition,
	NodeBodySpec,
	Inputs,
	InternalProcessContext,
	Outputs,
	ObjectDataValue,
} from '@ironclad/rivet-core';
import { sleep } from '../helpers/sleep.js';

const callGraphConnectionIds = {
	graph: 'graph' as PortId,
	inputs: 'inputs' as PortId,
	outputs: 'outputs' as PortId,
	error: 'error' as PortId,
	index: 'index' as PortId,
} as const;

const iteratorConnectionIds = {
	iteratorInputs: 'iteratorInputs' as PortId,
	iteratorOutputs: 'iteratorOutputs' as PortId,
	graph: 'graph' as PortId,
	chunkSize: 'chunkSize' as PortId,
	error: 'error' as PortId,
	enableCache: 'enableCache' as PortId,
} as const;

// This defines your new type of node.
export type IteratorNode = ChartNode<'iteratorNode', IteratorNodeData>;

// This defines the data that your new node will store.
export type IteratorNodeData = {
	chunkSize: number;
	enableCache: boolean;
	useChunkSizeToggle: boolean;
};

// Make sure you export functions that take in the Rivet library, so that you do not
// import the entire Rivet core library in your plugin.
export function registerIteratorNode(rivet: typeof Rivet) {
	const iteratorInputOutputsHelperMessage = rivet.dedent`Inputs must be an array of objects to iterate over.  Each object in the array should be a ObjectDataValue \`{type: 'object', value: <graph inputs>}\`; where <graph inputs> is of the format \`{type: 'object', value: {<graph input id>: <input value>}}\` The graph input id should match the graph's input ports.  The input value should be a DataValue. 

  Ouputs will be an array of ObjectDataValue \`type: 'object', value: {<graph output id>: <output value>}\``;

	/**************
	 * Plugin Code
	 */
	// This is your main node implementation. It is an object that implements the PluginNodeImpl interface.
	const IteratorNodeImpl: PluginNodeImpl<IteratorNode> = {
		// This should create a new instance of your node type from scratch.
		create(): IteratorNode {
			const node: IteratorNode = {
				// Use rivet.newId to generate new IDs for your nodes.
				id: rivet.newId<NodeId>(),

				// This is the default data that your node will store
				data: {
					chunkSize: 5,
					useChunkSizeToggle: false,
					enableCache: false,
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
					min: 1,
					max: 20,
					helperMessage:
						'The number of items to process at the same time.  This will help process arrays quickly while not overloading the system.  Recommended to keep this below 10 for subgraphs that make network calls or stream model responses.',
					useInputToggleDataKey: 'useChunkSizeToggle',
				},
				{
					type: 'toggle',
					dataKey: 'enableCache',
					label: 'Cache Execution',
					helperMessage: rivet.dedent`If true, the node will cache the successful results of the previous call graph executions. It will use the cached results for the same item inputs.`,
				},
			];
		},

		// This function returns the body of the node when it is rendered on the graph. You should show
		// what the current data of the node is in some way that is useful at a glance.
		getBody(data: IteratorNodeData): string | NodeBodySpec | NodeBodySpec[] | undefined {
			return rivet.dedent`Iterator Node
				Chunk Size: ${data.chunkSize}
				Enable Cache: ${data.enableCache}
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
			const graphRevalidationDigest = await createGraphDigest([graph]);
			const cacheNamespace = graphRef.graphId as string;
			const enableCache = data.enableCache && cacheNamespace != null;
			/**
			 * setup cache storage
			 */
			const cacheStorage = getCacheStorageForNamespace(cacheNamespace, graphRevalidationDigest);

			// validate input items to make sure they have all  keys of the  graph's input ports
			const missingKeys = new Set<string>();
			const notDataValue = new Set<string>();
			const invalidInputs = iteratorInputs.some((item) => {
				return validateGraphInput(rivet, item, graph, missingKeys, notDataValue);
			});

			if (invalidInputs) {
				outputs[iteratorConnectionIds.iteratorOutputs] = {
					type: 'control-flow-excluded',
					value: undefined,
				};
				let errorMessage = 'Input validation error: ';
				if (missingKeys.size > 0) {
					errorMessage += `Missing inputs required for graph: ${Array.from(missingKeys)
						.map((key) => key)
						.join('; ')}`;
				}
				// if (notDataValue.size > 0) {
				// 	errorMessage += rivet.dedent`Invalid Inputs, make sure each input item is a ObjectDataValue::
				//     ${Array.from(notDataValue)
				// 			.map((value) => JSON.stringify(value))
				// 			.join('; ')}`;
				// }
				outputs[iteratorConnectionIds.error] = {
					type: 'string',
					value: errorMessage,
				};
				return outputs;
			}

			// create a queue to process the array
			const queue = new PQueue({ concurrency: chunkSize });

			const graphNodeImplList = iteratorInputs.map((m, i) => {
				const node = rivet.callGraphNode.impl.create();
				node.id = rivet.newId<NodeId>();
				const impl = rivet.globalRivetNodeRegistry.createDynamicImpl(node);
				return impl;
			});

			const addToQueue = iteratorInputs.map((item: unknown, index) => {
				return queue.add<Outputs>(async (): Promise<Outputs> => {
					await sleep(1);
					let itemOutput: Outputs = {};
					itemOutput[callGraphConnectionIds.index] = {
						type: 'number',
						value: index,
					};
					try {
						if (!abortIteration) {
							// create a call graph node
							const impl = graphNodeImplList[index];

							// set the inputs
							let itemDataValue: ObjectDataValue = {
								type: 'object',
								value: item as Record<string, unknown>,
							};
							/**
							 * in case the item is already a DataValue, use it as is
							 */
							if (isObjectDataValue(rivet, item)) {
								itemDataValue = item;
							}

							const iteratorInputData: Inputs = {
								[callGraphConnectionIds.graph]: inputData[iteratorConnectionIds.graph],
								[callGraphConnectionIds.inputs]: itemDataValue,
							};

							if (enableCache) {
								const cacheKey = await createDigest(JSON.stringify(iteratorInputData));
								const cachedValue = await getCachedItem<Outputs>(cacheStorage, cacheKey);

								if (cachedValue != null) {
									await sleep(10);
									console.log(`Iterator ${index}: Using cached value`);
									return cachedValue;
								}
							}
							itemOutput = await impl.process(iteratorInputData, context);
							if (enableCache) {
								const cacheKey = await createDigest(JSON.stringify(iteratorInputData));
								setCachedItem(cacheStorage, cacheKey, itemOutput);
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
							value: rivet.dedent`Error running graph ${graphRef.graphName}.  
							Message::: ${rivet.getError(err).message}
							Input::: JSON ${JSON.stringify(item)}
							`,
						};
						abortIteration = true;
					}
					await sleep(1);
					return itemOutput;
				}) as Promise<Outputs>;
			});

			// wait for queue to finish
			const iteratorOutputs = await Promise.all(addToQueue);
			await queue.onEmpty();
			await sleep(1);

			if (enableCache) {
				void cleanExpiredCache();
			}

			const errorInIteratorOutputs = iteratorOutputs.some(
				(f) => f[callGraphConnectionIds.outputs]?.type === 'control-flow-excluded'
			);
			if (errorInIteratorOutputs) {
				const wasAborted = iteratorOutputs.some((f) =>
					(f[callGraphConnectionIds.error]?.value as string)?.includes?.('Aborted')
				);
				const itemErrors = iteratorOutputs
					.filter((f) => f[callGraphConnectionIds.outputs]?.type === 'control-flow-excluded')
					.map(
						(m, i) => rivet.dedent`Item Index ${i}:: 
					${m[callGraphConnectionIds.error]?.value}`
					)
					.join(';\n  ');

				outputs[iteratorConnectionIds.iteratorOutputs] = {
					type: 'control-flow-excluded',
					value: undefined,
				};
				outputs[iteratorConnectionIds.error] = {
					type: 'string',
					value: rivet.dedent`${wasAborted ? 'Iterator was aborted!\n' : ''}
					ItemErrors:
					${itemErrors}`,
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

	// Once a node is defined, you must pass it to rivet.pluginNodeDefinition, which will return a valid
	// PluginNodeDefinition object.
	const iteratorNode = rivet.pluginNodeDefinition(IteratorNodeImpl, 'Iterator Node');

	// This definition should then be used in the `register` function of your plugin definition.
	return iteratorNode;
}
