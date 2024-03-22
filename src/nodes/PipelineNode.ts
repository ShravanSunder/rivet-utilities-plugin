import {
	type ObjectDataValue,
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
	type isScalarDataType,
	type isArrayDataType,
	type isFunctionDataType,
	type LooseDataValue,
	type DataValue,
	type GraphReferenceNode,
	type NodeGraph,
	dedent,
	GraphReferenceValue,
} from '@ironclad/rivet-core';
import PQueue from 'p-queue';

import { createDigest } from '../helpers/createDigest.js';
import { isObjectDataValue } from '../helpers/dataValueHelpers.js';
import { validateGraphInputItem } from './functions/validateGraphInputItem.js';
import {
	getCacheStorageForNamespace,
	cleanExpiredCache,
	getCachedItem,
	setCachedItem,
	createGraphDigest,
} from '../helpers/cacheStorage';

const callGraphConnectionIds = {
	graph: 'graph' as PortId,
	inputs: 'inputs' as PortId,
	outputs: 'outputs' as PortId,
	error: 'error' as PortId,
	index: 'index' as PortId,
} as const;

const graphIdPrefix = 'graph-';
const pipelineConnectionIds = {
	pipelineInputs: 'pipelineInputs' as PortId,
	pipelineOutputs: 'pipelineOutputs' as PortId,
	graphPrefix: graphIdPrefix as PortId,
	getGraphId: (id: number | string) => `${graphIdPrefix}${id.toString()}` as PortId,
	chunkSize: 'chunkSize' as PortId,
	error: 'error' as PortId,
	enableCache: 'enableCache' as PortId,
} as const;

// This defines your new type of node.
export type PipelineNode = ChartNode<'pipelineNode', PipelineNodeData>;

// This defines the data that your new node will store.
export type PipelineNodeData = {
	chunkSize: number;
	enableCache: boolean;
	useChunkSizeToggle: boolean;
};

// Make sure you export functions that take in the Rivet library, so that you do not
// import the entire Rivet core library in your plugin.
export function registerPipelineNode(rivet: typeof Rivet) {
	const pipelineInputOutputsHelperMessage = rivet.dedent`Inputs must be an array of objects to iterate over.  Each object in the array should be a ObjectDataValue \`{type: 'object', value: <graph inputs>}\`; where <graph inputs> is of the format \`{type: 'object', value: {<graph input id>: <input value>}}\` The graph input id should match the graph's input ports.  The input value should be a DataValue. 

  Ouputs will be an array of ObjectDataValue \`type: 'object', value: {<graph output id>: <output value>}\``;

	/**************
	 * Plugin Code
	 */
	// This is your main node implementation. It is an object that implements the PluginNodeImpl interface.
	class PipelineNodeImpl implements PluginNodeImpl<PipelineNode> {
		#nodeId: NodeId = '' as NodeId;

		// This should create a new instance of your node type from scratch.
		create(): PipelineNode {
			this.#nodeId = rivet.newId<NodeId>();
			const node: PipelineNode = {
				// Use rivet.newId to generate new IDs for your nodes.
				id: this.#nodeId,

				// This is the default data that your node will store
				data: {
					chunkSize: 5,
					useChunkSizeToggle: false,
					enableCache: false,
				} satisfies PipelineNodeData,

				// This is the default title of your node.
				title: 'Pipeline Node',

				// This must match the type of your node.
				type: 'pipelineNode',

				// X and Y should be set to 0. Width should be set to a reasonable number so there is no overflow.
				visualData: {
					x: 0,
					y: 0,
					width: 200,
				},
			};
			return node;
		}

		#getGraphInputPortCount(connections: NodeConnection[]): number {
			const inputNodeId = this.#nodeId;
			const inputConnections = connections.filter(
				(connection) =>
					connection.inputNodeId === inputNodeId && connection.inputId.startsWith(pipelineConnectionIds.graphPrefix)
			);

			let maxInputNumber = 0;
			for (const connection of inputConnections) {
				const inputNumber = parseInt(connection.inputId.replace(pipelineConnectionIds.graphPrefix, ''));
				if (inputNumber > maxInputNumber) {
					maxInputNumber = inputNumber;
				}
			}

			return maxInputNumber + 1;
		}

		// This function should return all input ports for your node, given its data, connections, all other nodes, and the project. The
		// connection, nodes, and project are for advanced use-cases and can usually be ignored.
		getInputDefinitions(
			data: PipelineNodeData,
			connections: NodeConnection[],
			_nodes: Record<NodeId, ChartNode>,
			_project: Project
		): NodeInputDefinition[] {
			const inputs: NodeInputDefinition[] = [];

			inputs.push({
				id: pipelineConnectionIds.pipelineInputs,
				dataType: 'object[]',
				title: 'Pipeline Inputs Array',
				description: pipelineInputOutputsHelperMessage,
				required: true,
			});

			const graphInputCount = this.#getGraphInputPortCount(connections);
			for (let i = 0; i <= graphInputCount; i++) {
				inputs.push({
					id: pipelineConnectionIds.getGraphId(i),
					dataType: 'graph-reference',
					title: `Graph: ${i}`,
					description: `The reference to the graph to call for pipeline graph ${i}`,
					required: true,
				});
			}

			if (data.useChunkSizeToggle) {
				inputs.push({
					id: pipelineConnectionIds.chunkSize,
					dataType: 'number',
					title: 'Chunk Size',
					description: 'The concurrency limit: The number of items to process at the same time.',
					data: data.chunkSize,
				});
			}

			return inputs;
		}

		// This function should return all output ports for your node, given its data, connections, all other nodes, and the project. The
		// connection, nodes, and project are for advanced use-cases and can usually be ignored.
		getOutputDefinitions(
			data: PipelineNodeData,
			_connections: NodeConnection[],
			_nodes: Record<NodeId, ChartNode>,
			_project: Project
		): NodeOutputDefinition[] {
			return [
				{
					id: pipelineConnectionIds.pipelineOutputs,
					dataType: 'object[]',
					title: 'Pipeline Output Array',
				},
			];
		}

		// This returns UI information for your node, such as how it appears in the context menu.
		getUIData(): NodeUIData {
			return {
				contextMenuTitle: 'Pipeline Node',
				group: 'Logic',
				infoBoxBody: rivet.dedent`This is an pipeline node.  This node will map over an array and process each item with the graph provided. 
          
          ${pipelineInputOutputsHelperMessage}`,
				infoBoxTitle: 'Pipeline Node',
			};
		}

		// This function defines all editors that appear when you edit your node.
		getEditors(_data: PipelineNodeData): EditorDefinition<PipelineNode>[] {
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
					dataKey: 'enableCache',
					label: 'Cache Execution',
					helperMessage: rivet.dedent`If true, the node will cache the successful results of the previous call graph executions. It will use the cached results for the same item inputs.`,
				},
			];
		}

		// This function returns the body of the node when it is rendered on the graph. You should show
		// what the current data of the node is in some way that is useful at a glance.
		getBody(data: PipelineNodeData): string | NodeBodySpec | NodeBodySpec[] | undefined {
			return rivet.dedent`Pipeline Node
				Chunk Size: ${data.chunkSize}
				Enable Cache: ${data.enableCache}
      `;
		}

		// This is the main processing function for your node. It can do whatever you like, but it must return
		// a valid Outputs object, which is a map of port IDs to DataValue objects. The return value of this function
		// must also correspond to the output definitions you defined in the getOutputDefinitions function.
		async process(data: PipelineNodeData, inputData: Inputs, context: InternalProcessContext): Promise<Outputs> {
			const outputs: Outputs = {};

			let abortIteration = false;
			context.signal.addEventListener('abort', () => {
				abortIteration = true;
			});

			const pipelineInputs = rivet.coerceType(inputData[pipelineConnectionIds.pipelineInputs], 'object[]');
			let chunkSize = rivet.coerceTypeOptional(inputData[pipelineConnectionIds.chunkSize], 'number') ?? data.chunkSize;
			chunkSize = chunkSize > 0 ? chunkSize : 1;

			/**
			 * validate input array, they should all be objects
			 */
			const allItemsAreObjects = pipelineInputs.some((s) => typeof s !== 'object');
			if (allItemsAreObjects) {
				outputs[pipelineConnectionIds.pipelineOutputs] = {
					type: 'control-flow-excluded',
					value: undefined,
				};
				outputs[pipelineConnectionIds.error] = {
					type: 'string',
					value: rivet.dedent`Input array must be an array of objects.  Each object needs to be a DataValue.  A graph needs an object with keys that match the graph's input ports`,
				};
				return outputs;
			}

			/**
			 * Get number of graphs with connections
			 */
			const numOfGraphs =
				Object.keys(inputData).filter((key) => key.startsWith(pipelineConnectionIds.graphPrefix)).length - 1;
			/**
			 * get all graphs form inputData with connections
			 */
			const graphs: NodeGraph[] = [];
			for (let i = 0; i < numOfGraphs; i++) {
				const graphRef = rivet.coerceType(inputData[pipelineConnectionIds.getGraphId(i)], 'graph-reference');

				if (graphRef.graphId && !graphRef.graphName) {
					const graph = context.project.graphs[graphRef.graphId];
					graphs.push(graph);
				}
			}

			const revalidationDigest = await createGraphDigest(graphs);
			const cacheNamespace = `pipeline-${this.#nodeId as string}`;
			const enableCache = data.enableCache && cacheNamespace != null;
			/**
			 * cache storage
			 */
			const cacheStorage = getCacheStorageForNamespace(cacheNamespace, revalidationDigest);

			// validate input items to make sure they have all  keys of the  graph's input ports
			const missingKeys = new Set<string>();
			const notDataValue = new Set<string>();
			const invalidInputs = pipelineInputs.some((item) => {
				return validateGraphInputItem(rivet, item, graph, missingKeys, notDataValue);
			});

			if (invalidInputs) {
				outputs[pipelineConnectionIds.pipelineOutputs] = {
					type: 'control-flow-excluded',
					value: undefined,
				};
				let errorMessage = 'Input validation error: ';
				if (missingKeys.size > 0) {
					errorMessage += `Missing keys required for graph: 
            ${Array.from(missingKeys)
							.map((key) => key)
							.join('; ')}`;
				}
				if (notDataValue.size > 0) {
					errorMessage += rivet.dedent`Invalid Inputs, make sure each input item is a ObjectDataValue:: 
            ${Array.from(notDataValue)
							.map((value) => JSON.stringify(value))
							.join('; ')}`;
				}
				outputs[pipelineConnectionIds.error] = {
					type: 'string',
					value: errorMessage,
				};
				return outputs;
			}

			// create a queue to process the array
			const queue = new PQueue({ concurrency: chunkSize });

			const graphNodeImplList = pipelineInputs.map((m, i) => {
				const node = rivet.callGraphNode.impl.create();
				node.id = rivet.newId<NodeId>();
				const impl = rivet.globalRivetNodeRegistry.createDynamicImpl(node);
				return impl;
			});

			const addToQueue = pipelineInputs.map((item: unknown, index) => {
				return queue.add<Outputs>(async (): Promise<Outputs> => {
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
							if (isObjectDataValue(rivet, item)) {
								itemDataValue = item;
							}

							const pipelineInputData: Inputs = {
								[callGraphConnectionIds.graph]: inputData[pipelineConnectionIds.getGraphId(0)],
								[callGraphConnectionIds.inputs]: itemDataValue,
							};

							if (enableCache) {
								const cacheKey = await createDigest(JSON.stringify(pipelineInputData));
								const cachedValue = await getCachedItem<Outputs>(cacheStorage, cacheKey);

								if (cachedValue != null) {
									console.log(`Pipeline ${index}: Using cached value`);
									return cachedValue;
								}
							}
							itemOutput = await impl.process(pipelineInputData, context);
							if (enableCache) {
								const cacheKey = await createDigest(JSON.stringify(pipelineInputData));
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
					return itemOutput;
				}) as Promise<Outputs>;
			});

			// wait for queue to finish
			const pipelineOutputs = await Promise.all(addToQueue);
			await queue.onEmpty();

			if (enableCache) {
				void cleanExpiredCache();
			}

			const errorInPipelineOutputs = pipelineOutputs.some(
				(f) => f[callGraphConnectionIds.outputs]?.type === 'control-flow-excluded'
			);
			if (errorInPipelineOutputs) {
				const wasAborted = pipelineOutputs.some((f) =>
					(f[callGraphConnectionIds.error]?.value as string)?.includes?.('Aborted')
				);
				const itemErrors = pipelineOutputs
					.filter((f) => f[callGraphConnectionIds.outputs]?.type === 'control-flow-excluded')
					.map(
						(m, i) => rivet.dedent`Item Index ${i}:: 
					${m[callGraphConnectionIds.error]?.value}`
					)
					.join(';\n  ');

				outputs[pipelineConnectionIds.pipelineOutputs] = {
					type: 'control-flow-excluded',
					value: undefined,
				};
				outputs[pipelineConnectionIds.error] = {
					type: 'string',
					value: rivet.dedent`${wasAborted ? 'Pipeline was aborted!\n' : ''}
					ItemErrors:
					${itemErrors}`,
				};
				return outputs;
			}

			// process pipelineOutputs
			outputs[pipelineConnectionIds.pipelineOutputs] = {
				type: 'object[]',
				value: pipelineOutputs,
			};
			return outputs;
		}
	}

	// Once a node is defined, you must pass it to rivet.pluginNodeDefinition, which will return a valid
	// PluginNodeDefinition object.
	const pipelineNode = rivet.pluginNodeDefinition(new PipelineNodeImpl(), 'Pipeline Node');

	// This definition should then be used in the `register` function of your plugin definition.
	return pipelineNode;
}
