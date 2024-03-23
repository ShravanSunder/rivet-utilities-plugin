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
	NodeConnection,
	PluginNodeImpl,
	NodeId,
	Project,
	NodeInputDefinition,
	NodeOutputDefinition,
	NodeUIData,
	EditorDefinition,
	NodeBodySpec,
	Inputs,
	InternalProcessContext,
	Outputs,
	NodeGraph,
	ObjectDataValue,
} from '@ironclad/rivet-core';

const callGraphConnectionIds = {
	graph: 'graph' as PortId,
	inputs: 'inputs' as PortId,
	outputs: 'outputs' as PortId,
	error: 'error' as PortId,
	stageIndex: 'stageIndex' as PortId,
} as const;

const graphIdPrefix = 'graph-';
const pipelineConnectionIds = {
	pipelineInput: 'pipelineInput' as PortId,
	pipelineOutput: 'pipelineOutput' as PortId,
	/**
	 * intermediate stage outputs
	 */
	intermediateStageOutputs: 'intermediateStageOutputs' as PortId,
	graphPrefix: graphIdPrefix as PortId,
	getGraphId: (id: number | string) => `${graphIdPrefix}${id.toString()}` as PortId,
	error: 'error' as PortId,
	enableCache: 'enableCache' as PortId,
} as const;

// This defines your new type of node.
export type PipelineNode = ChartNode<'pipelineNode', PipelineNodeData>;

// This defines the data that your new node will store.
export type PipelineNodeData = {
	enableCache: boolean;
	loopPipeline: boolean;
	numberOfPipelineLoops: number;
};

// Make sure you export functions that take in the Rivet library, so that you do not
// import the entire Rivet core library in your plugin.
export function registerPipelineNode(rivet: typeof Rivet) {
	const pipelineInputOutputsHelperMessage = rivet.dedent`Pipeline Input must be an Object.  The object should be a ObjectDataValue \`{type: 'object', value: <graph inputs>}\`; where <graph inputs> is of the format \`{type: 'object', value: {<graph input id>: <input value>}}\` The graph input id should match the graph's input ports.  The input value should be a DataValue. 

  Pipeline Ouput will be an ObjectDataValue \`type: 'object', value: {<graph output id>: <output value>}\``;

	const getGraphInputPortCount = (connections: NodeConnection[]): number => {
		const inputConnections = connections.filter((connection) =>
			/* connection.inputNodeId === nodeId && */ connection.inputId.startsWith(pipelineConnectionIds.graphPrefix)
		);

		let maxInputNumber = 0;
		for (const connection of inputConnections) {
			const inputNumber = parseInt(connection.inputId.replace(pipelineConnectionIds.graphPrefix, ''));
			if (inputNumber > maxInputNumber) {
				maxInputNumber = inputNumber;
			}
		}

		return maxInputNumber + 1;
	};

	/**************
	 * Plugin Code
	 */
	// This is your main node implementation. It is an object that implements the PluginNodeImpl interface.
	const pipelineNodeImpl: PluginNodeImpl<PipelineNode> = {
		// This should create a new instance of your node type from scratch.
		create(): PipelineNode {
			console.log('Pipeline', 'create');
			const node: PipelineNode = {
				// Use rivet.newId to generate new IDs for your nodes.
				id: rivet.newId<NodeId>(),

				// This is the default data that your node will store
				data: {
					enableCache: false,
					loopPipeline: false,
					numberOfPipelineLoops: 1,
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
		},

		// This function should return all input ports for your node, given its data, connections, all other nodes, and the project. The
		// connection, nodes, and project are for advanced use-cases and can usually be ignored.
		getInputDefinitions(
			data: PipelineNodeData,
			connections: NodeConnection[],
			nodes: Record<NodeId, ChartNode>,
			_project: Project
		): NodeInputDefinition[] {
			console.log('Pipeline', 'getInputDefinitions', data);
			const inputs: NodeInputDefinition[] = [];

			inputs.push({
				id: pipelineConnectionIds.pipelineInput,
				dataType: 'object',
				title: 'Pipeline Input',
				description: pipelineInputOutputsHelperMessage,
				required: true,
			});

			const graphInputCount = getGraphInputPortCount(connections);
			for (let i = 0; i <= graphInputCount; i++) {
				inputs.push({
					id: pipelineConnectionIds.getGraphId(i),
					dataType: 'graph-reference',
					title: `Graph: ${i}`,
					description: `The reference to the graph to call for pipeline graph ${i}`,
					required: false,
				});
			}

			return inputs;
		},

		// This function should return all output ports for your node, given its data, connections, all other nodes, and the project. The
		// connection, nodes, and project are for advanced use-cases and can usually be ignored.
		getOutputDefinitions(
			data: PipelineNodeData,
			_connections: NodeConnection[],
			_nodes: Record<NodeId, ChartNode>,
			_project: Project
		): NodeOutputDefinition[] {
			console.log('Pipeline', 'getOutputDefinitions');
			return [
				{
					id: pipelineConnectionIds.pipelineOutput,
					dataType: 'object',
					title: 'Pipeline Output',
				},
			];
		},

		// This returns UI information for your node, such as how it appears in the context menu.
		getUIData(): NodeUIData {
			console.log('Pipeline', 'getUIData');
			return {
				contextMenuTitle: 'Pipeline Node',
				group: 'Logic',
				infoBoxBody: rivet.dedent`This is an pipeline node.  This node will map over an array and process each item with the graph provided. 
          
          ${pipelineInputOutputsHelperMessage}`,
				infoBoxTitle: 'Pipeline Node',
			};
		},

		// This function defines all editors that appear when you edit your node.
		getEditors(data: PipelineNodeData): EditorDefinition<PipelineNode>[] {
			const repeatePipeline = data.loopPipeline;
			let conditionalUi: EditorDefinition<PipelineNode>[] = [];
			if (repeatePipeline) {
				conditionalUi = [
					{
						type: 'number',
						dataKey: 'numberOfPipelineLoops',
						label: 'Number of Pipeline Loops',
						min: 1,
						max: 100,
						helperMessage:
							'Number of times to loop the pipeline. The output of the pipeline will be the input of the next run.',
					},
				];
			}

			return [
				{
					type: 'toggle',
					dataKey: 'enableCache',
					label: 'Cache Execution',
					helperMessage: rivet.dedent`If true, the node will cache the successful results of the previous call graph executions. It will use the cached results for the same item inputs.`,
				},
				{
					type: 'toggle',
					dataKey: 'loopPipeline',
					label: 'Loop Pipeline',
					helperMessage:
						'Enable this option to run the pipeline in a loop a specific number of times.  The output of the pipeline will be the input of the next run.',
				},
				...conditionalUi,
			];
		},

		// This function returns the body of the node when it is rendered on the graph. You should show
		// what the current data of the node is in some way that is useful at a glance.
		getBody(data: PipelineNodeData): string | NodeBodySpec | NodeBodySpec[] | undefined {
			console.log('Pipeline', 'getBody', data);
			return rivet.dedent`Pipeline Node
				Enable Cache: ${data.enableCache}
				Loop Pipeline: ${data.loopPipeline}
				${data.loopPipeline ? `Number of Loops: ${data.numberOfPipelineLoops}` : ''}
      `;
		},

		async process(data: PipelineNodeData, inputData: Inputs, context: InternalProcessContext): Promise<Outputs> {
			console.log('Pipeline', 'process', inputData);
			const outputs: Outputs = {};

			let abortIteration = false;
			context.signal.addEventListener('abort', () => {
				abortIteration = true;
			});

			const invalidEntryInput = !isObjectDataValue(rivet, inputData[pipelineConnectionIds.pipelineInput]);
			if (invalidEntryInput) {
				outputs[pipelineConnectionIds.pipelineOutput] = {
					type: 'control-flow-excluded',
					value: undefined,
				};
				outputs[pipelineConnectionIds.error] = {
					type: 'string',
					value: rivet.dedent`Pipeline Input must be an Object.  The object should be a ObjectDataValue \`{type: 'object', value: <graph inputs>}\`; where <graph inputs> is of the format \`{type: 'object', value: {<graph input id>: <input value>}}\` The graph input id should match the graph's input ports.  The input value should be a DataValue. `,
				};
				return outputs;
			}

			/**
			 * Get number of graphs with connections
			 */
			const numOfGraphs = Object.keys(inputData).filter((key) =>
				key.startsWith(pipelineConnectionIds.graphPrefix)
			).length;
			/**
			 * get all graphs form inputData with connections
			 */
			const graphs: NodeGraph[] = Array.from({ length: numOfGraphs }, (_, i) => {
				const graphRef = rivet.coerceType(inputData[pipelineConnectionIds.getGraphId(i)], 'graph-reference');
				if (graphRef.graphId && graphRef.graphName) {
					return context.project.graphs[graphRef.graphId];
				}
			}).filter((f) => f != null) as NodeGraph[];
			const enableCache = data.enableCache;
			/**
			 * cache storage
			 */

			const pipelineEntryInput = rivet.coerceType(inputData[pipelineConnectionIds.pipelineInput], 'object');

			let nextStageInput: Record<string, unknown> = pipelineEntryInput;
			const intermediateStageOutputs: Record<string, unknown>[] = [];

			const numberOfPipelineLoops = Math.max(data.loopPipeline ? data.numberOfPipelineLoops : 1, 1) ?? 1;
			for (let loopNum = 1; loopNum <= numberOfPipelineLoops; loopNum++) {
				for (let i = 0; i < numOfGraphs; i++) {
					/**
					 * prior stage's output is the next stage's input
					 * spread to shallow copy the object
					 */
					const stageInput = { ...nextStageInput };
					const graphRef = rivet.coerceType(inputData[pipelineConnectionIds.getGraphId(i)], 'graph-reference');
					const graph = graphs[i];

					if (!graphRef.graphId || !graphRef.graphName || graph == null) {
						outputs[pipelineConnectionIds.pipelineOutput] = {
							type: 'control-flow-excluded',
							value: undefined,
						};
						outputs[pipelineConnectionIds.error] = {
							type: 'string',
							value: `Graph reference is invalid for graph ${i}`,
						};
						return outputs;
					}

					if (typeof stageInput !== 'object' || stageInput == null || Array.isArray(stageInput)) {
						/**
						 * validate input array, they should all be objects
						 */
						outputs[pipelineConnectionIds.pipelineOutput] = {
							type: 'control-flow-excluded',
							value: undefined,
						};
						outputs[pipelineConnectionIds.error] = {
							type: 'string',
							value: rivet.dedent`Input must be an object.  Each stage's input should match the prior stage's output shape.  Error: loop-${loopNum} pipeline-stage-${i}`,
						};
						return outputs;
					}

					// validate input items to make sure they have all  keys of the  graph's input ports
					const missingKeys = new Set<string>();
					const notDataValue = new Set<string>();
					const invalidInputs = validateGraphInput(rivet, stageInput, graph, missingKeys, notDataValue);

					if (invalidInputs) {
						outputs[pipelineConnectionIds.pipelineOutput] = {
							type: 'control-flow-excluded',
							value: undefined,
						};
						let errorMessage = `Input validation error for loop-${loopNum} pipeline-stage-${i}: `;
						if (missingKeys.size > 0) {
							errorMessage += `Missing inputs required for graph: ${Array.from(missingKeys)
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

					try {
						if (!abortIteration) {
							console.log(`loop-${loopNum} pipeline-stage-${i}: Running graph ${graphRef.graphName}`);
							// create a call graph node
							const node = rivet.callGraphNode.impl.create();
							const impl = rivet.globalRivetNodeRegistry.createDynamicImpl(node);

							// set the inputs
							let stageGraphInputDataValue: ObjectDataValue = {
								type: 'object',
								value: stageInput as Record<string, unknown>,
							};
							/**
							 * in case the item is already a DataValue, use it as is
							 */
							if (isObjectDataValue(rivet, stageInput)) {
								stageGraphInputDataValue = stageInput;
							}

							const pipelineInputData: Inputs = {
								[callGraphConnectionIds.graph]: inputData[pipelineConnectionIds.getGraphId(i)],
								[callGraphConnectionIds.inputs]: stageGraphInputDataValue,
							};

							/**
							 * Setup cache storage for the graph
							 */
							const graphRevalidationDigest = await createGraphDigest([graph]);
							const cacheNamespace = graphRef.graphId as string;
							const cacheStorage = getCacheStorageForNamespace(cacheNamespace, graphRevalidationDigest);

							if (enableCache) {
								/**
								 * Check if the item is in the cache
								 */
								const cacheKey = await createDigest(JSON.stringify(pipelineInputData));
								const cachedValue = await getCachedItem<Outputs>(cacheStorage, cacheKey);

								if (cachedValue != null) {
									console.log(`Pipeline ${i}: Using cached value`);
									return cachedValue;
								}
							}
							const graphOutput = await impl.process(pipelineInputData, context);
							if (enableCache) {
								/**
								 * Set the item in the cache
								 */
								const cacheKey = await createDigest(JSON.stringify(pipelineInputData));
								setCachedItem(cacheStorage, cacheKey, outputs);
							}
							nextStageInput = rivet.coerceType(graphOutput[callGraphConnectionIds.outputs], 'object');
							intermediateStageOutputs.push({ stage: i, graphName: graphRef.graphName, graphOutput: nextStageInput });
						} else {
							/**
							 * If aborted
							 */
							outputs[pipelineConnectionIds.pipelineOutput] = {
								type: 'control-flow-excluded',
								value: undefined,
							};
							outputs[pipelineConnectionIds.error] = {
								type: 'string',
								value: `Aborted ${graphRef.graphName}`,
							};
							stageInput;
							break;
						}
					} catch (err) {
						outputs[pipelineConnectionIds.pipelineOutput] = {
							type: 'control-flow-excluded',
							value: undefined,
						};

						outputs[pipelineConnectionIds.pipelineOutput] = {
							type: 'string',
							value: rivet.dedent`Error running graph ${graphRef.graphName}.
							Message::: ${rivet.getError(err).message}
							Input::: JSON ${JSON.stringify(stageInput)}
							`,
						};
						abortIteration = true;
					}
				}
			}

			outputs[pipelineConnectionIds.pipelineOutput] = {
				type: 'object',
				value: nextStageInput,
			};
			outputs[pipelineConnectionIds.intermediateStageOutputs] = {
				type: 'object[]',
				value: intermediateStageOutputs,
			};

			return outputs;
		},
	};

	// Once a node is defined, you must pass it to rivet.pluginNodeDefinition, which will return a valid
	// PluginNodeDefinition object.
	const pipelineNode = rivet.pluginNodeDefinition(pipelineNodeImpl, 'Pipeline Node');

	// This definition should then be used in the `register` function of your plugin definition.
	return pipelineNode;
}
