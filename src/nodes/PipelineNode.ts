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
	DataValue,
	GraphReferenceValue,
	GraphId,
} from '@ironclad/rivet-core';
import { sleep } from '../helpers/sleep.js';
import { stringify } from 'superjson';

const callGraphConnectionIds = {
	graph: 'graph' as PortId,
	inputs: 'inputs' as PortId,
	outputs: 'outputs' as PortId,
	error: 'error' as PortId,
	stageIndex: 'stageIndex' as PortId,
} as const;

const pipelineGraphIdPrefix = 'graph-';
const postPipelineGraphIdPrefix = 'post-';
const pipelineConnectionIds = {
	pipelineInput: 'pipelineInput' as PortId,
	pipelineOutput: 'pipelineOutput' as PortId,
	/**
	 * intermediate stage outputs
	 */
	intermediateStageOutputs: 'intermediateStageOutputs' as PortId,
	graphPrefix: pipelineGraphIdPrefix as PortId,
	getGraphId: (id: number | string) => `${pipelineGraphIdPrefix}${id.toString()}` as PortId,
	postPrefix: postPipelineGraphIdPrefix as PortId,
	getPostId: (id: number | string) => `${postPipelineGraphIdPrefix}${id.toString()}` as PortId,
	prePipelineGraph: 'prePipelineGraph' as PortId,
	error: 'error' as PortId,
	enableCache: 'enableCache' as PortId,
	numberOfPipelineLoops: 'numberOfPipelineLoops' as PortId,
} as const;

// This defines your new type of node.
export type PipelineNode = ChartNode<'pipelineNode', PipelineNodeData>;

// This defines the data that your new node will store.
export type PipelineNodeData = {
	enableCache: boolean;
	numberOfPipelineLoops: number;
	useNumberOfPipelineLoopsToggle: boolean;
};

// Make sure you export functions that take in the Rivet library, so that you do not
// import the entire Rivet core library in your plugin.
export function registerPipelineNode(rivet: typeof Rivet) {
	const pipelineInputOutputsHelperMessage = rivet.dedent`Pipeline Input must be an Object.  The object should be a ObjectDataValue \`{type: 'object', value: <graph inputs>}\`; where <graph inputs> is of the format \`{type: 'object', value: {<graph input id>: <input value>}}\` The graph input id should match the graph's input ports.  The input value should be a DataValue. 

  Pipeline Ouput will be an ObjectDataValue \`type: 'object', value: {<graph output id>: <output value>}\``;

	/**************
	 * Plugin Code
	 */
	// This is your main node implementation. It is an object that implements the PluginNodeImpl interface.
	const pipelineNodeImpl: PluginNodeImpl<PipelineNode> = {
		// This should create a new instance of your node type from scratch.
		create(): PipelineNode {
			const node: PipelineNode = {
				// Use rivet.newId to generate new IDs for your nodes.
				id: rivet.newId<NodeId>(),

				// This is the default data that your node will store
				data: {
					enableCache: false,
					numberOfPipelineLoops: 1,
					useNumberOfPipelineLoopsToggle: false,
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
			const inputs: NodeInputDefinition[] = [];

			if (data.useNumberOfPipelineLoopsToggle) {
				inputs.push({
					id: pipelineConnectionIds.numberOfPipelineLoops,
					dataType: 'number',
					title: 'Number of Pipeline Loops',
					description:
						'Number of times to loop the pipeline. The output of the pipeline will be the input of the next run.',
					required: true,
				});
			}

			inputs.push({
				id: pipelineConnectionIds.pipelineInput,
				dataType: 'object',
				title: 'Pipeline Input',
				description: pipelineInputOutputsHelperMessage,
				required: true,
			});

			inputs.push({
				id: pipelineConnectionIds.prePipelineGraph,
				dataType: 'graph-reference',
				title: 'Pre-pipeline Graph',
				description:
					'The reference to the graph to call at the very beginning of pipeline process.  This graph will be called before any of the pipeline graphs are called. The output of this graph will be the input to the first pipeline graph.',
				required: false,
			});

			const graphInputCount = getPipelineGraphInputPortCount(connections, pipelineConnectionIds.graphPrefix);
			for (let i = 0; i <= graphInputCount; i++) {
				inputs.push({
					id: pipelineConnectionIds.getGraphId(i),
					dataType: 'graph-reference',
					title: `Stage ${i} Graph`,
					description: `The reference to the graph to call for pipeline graph ${i}`,
					required: false,
				});
			}

			const postGraphInputCount = getPipelineGraphInputPortCount(connections, pipelineConnectionIds.postPrefix);
			for (let i = 0; i <= postGraphInputCount; i++) {
				inputs.push({
					id: pipelineConnectionIds.getPostId(i),
					dataType: 'graph-reference',
					title: `Post-pipeline Graph ${i}`,
					description:
						'The reference to the graph to call at the very end of pipeline process.  This graph will be called after all the pipeline loops are done. The output of the last pipeline graph will be the input to this graph.',
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
			return [
				{
					type: 'number',
					dataKey: 'numberOfPipelineLoops',
					label: 'Number of Pipeline Loops',
					min: 1,
					max: 100,
					helperMessage:
						'Number of times to loop the pipeline. The output of the pipeline will be the input of the next run.',
					useInputToggleDataKey: 'useNumberOfPipelineLoopsToggle',
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
		getBody(data: PipelineNodeData): string | NodeBodySpec | NodeBodySpec[] | undefined {
			return rivet.dedent`Pipeline Node
				Enable Cache: ${data.enableCache}
				Number of Loops:  ${data.useNumberOfPipelineLoopsToggle ? '(using input)' : data.numberOfPipelineLoops}
      `;
		},

		async process(data: PipelineNodeData, inputData: Inputs, context: InternalProcessContext): Promise<Outputs> {
			let outputs: Outputs = {};

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
			 * Get the enable cache flag
			 */
			const enableCache = data.enableCache;

			/**
			 * The next stage input is the prior stage output
			 */
			let nextStageInput: Record<string, unknown> = {
				pipelineInput: inputData[pipelineConnectionIds.pipelineInput],
			};
			const intermediateStageLogsOut: Record<string, unknown>[] = [];

			await sleep(1);
			/** ****************
			 * Pre Pipeline Graph
			 */
			if (inputData[pipelineConnectionIds.prePipelineGraph]) {
				const prePipelineGraphRef = rivet.coerceType(
					inputData[pipelineConnectionIds.prePipelineGraph],
					'graph-reference'
				);

				if (prePipelineGraphRef.graphId && prePipelineGraphRef.graphName) {
					outputs = await processPipelineStage(
						rivet,
						{
							context,
							nodeInputData: inputData,
							enableCache,
						},
						{
							stageInput: nextStageInput,
							stageGraph: context.project.graphs[prePipelineGraphRef.graphId],
							stageGraphRef: prePipelineGraphRef,
							stageIdentifier: 'stage-pre',
						},
						intermediateStageLogsOut
					);
				}
				if (
					outputs[pipelineConnectionIds.error] ||
					outputs[pipelineConnectionIds.pipelineOutput]?.type === 'control-flow-excluded'
				) {
					return outputs;
				}

				const stageOutput = outputs[pipelineConnectionIds.pipelineOutput]?.value as Record<string, unknown>;
				nextStageInput = { ...stageOutput };
				nextStageInput.pipelineInput = inputData[pipelineConnectionIds.pipelineInput];
			}

			await sleep(1);
			{
				/** ****************
				 * Pipeline Graphs
				 */

				/**
				 * Get number of graphs with connections
				 */
				const pipelineGraphCount = Object.keys(inputData).filter((key) =>
					key.startsWith(pipelineConnectionIds.graphPrefix)
				).length;
				/**
				 * get all graphs form inputData with connections
				 */
				const graphs: NodeGraph[] = Array.from({ length: pipelineGraphCount }, (_, i) => {
					const graphRef = rivet.coerceType(inputData[pipelineConnectionIds.getGraphId(i)], 'graph-reference');
					if (graphRef.graphId && graphRef.graphName) {
						return context.project.graphs[graphRef.graphId];
					}
				}).filter((f) => f != null) as NodeGraph[];

				const numberOfPipelineLoops =
					Math.min(
						Math.max(
							rivet.coerceType(inputData[pipelineConnectionIds.numberOfPipelineLoops], 'number') ??
								data.numberOfPipelineLoops,
							1
						),
						100
					) ?? 1;

				for (let loopIndex = 0; loopIndex < numberOfPipelineLoops; loopIndex++) {
					await sleep(1);
					for (let pipelineIndex = 0; pipelineIndex < pipelineGraphCount; pipelineIndex++) {
						await sleep(1);
						const graph = graphs[pipelineIndex];
						const graphRef = rivet.coerceType(
							inputData[pipelineConnectionIds.getGraphId(pipelineIndex)],
							'graph-reference'
						);

						nextStageInput.pipelineStageIndex = pipelineIndex;
						nextStageInput.pipelineLoopIndex = loopIndex;
						nextStageInput.pipelineGraphCount = pipelineGraphCount;
						nextStageInput.pipelineIndex = loopIndex * pipelineGraphCount + pipelineIndex;

						outputs = await processPipelineStage(
							rivet,
							{
								context,
								nodeInputData: inputData,
								enableCache,
							},
							{
								stageInput: nextStageInput,
								stageGraph: graph,
								stageGraphRef: graphRef,
								stageIdentifier: `loop-${loopIndex} stage-${pipelineIndex}`,
							},
							intermediateStageLogsOut
						);

						if (
							outputs[pipelineConnectionIds.error] ||
							outputs[pipelineConnectionIds.pipelineOutput]?.type === 'control-flow-excluded'
						) {
							return outputs;
						}

						const stageOutput = outputs[pipelineConnectionIds.pipelineOutput]?.value as Record<string, unknown>;
						nextStageInput = { ...stageOutput };
						nextStageInput.pipelineInput = inputData[pipelineConnectionIds.pipelineInput];
					}
				}

				await sleep(1);
			}
			/**  ****************
			 * Post Pipeline Graph
			 */

			// post pipeline graphs
			const postGraphCount = Object.keys(inputData).filter((key) =>
				key.startsWith(pipelineConnectionIds.postPrefix)
			).length;
			/**
			 * get all graphs form inputData with connections
			 */
			const postGraphs: NodeGraph[] = Array.from({ length: postGraphCount }, (_, i) => {
				const graphRef = rivet.coerceType(inputData[pipelineConnectionIds.getPostId(i)], 'graph-reference');
				if (graphRef.graphId && graphRef.graphName) {
					return context.project.graphs[graphRef.graphId];
				}
			}).filter((f) => f != null) as NodeGraph[];

			if (postGraphs.length > 0) {
				for (let pipelineIndex = 0; pipelineIndex < postGraphCount; pipelineIndex++) {
					const postPipelineGraphRef = rivet.coerceType(
						inputData[pipelineConnectionIds.getPostId(pipelineIndex)],
						'graph-reference'
					);

					if (postPipelineGraphRef.graphId && postPipelineGraphRef.graphName) {
						outputs = await processPipelineStage(
							rivet,
							{
								context,
								nodeInputData: inputData,
								enableCache,
							},
							{
								stageInput: nextStageInput,
								stageGraph: context.project.graphs[postPipelineGraphRef.graphId],
								stageGraphRef: postPipelineGraphRef,
								stageIdentifier: 'stage-post',
							},
							intermediateStageLogsOut
						);
					}

					if (
						outputs[pipelineConnectionIds.error] ||
						outputs[pipelineConnectionIds.pipelineOutput]?.type === 'control-flow-excluded'
					) {
						return outputs;
					}

					const stageOutput = outputs[pipelineConnectionIds.pipelineOutput]?.value as Record<string, unknown>;
					nextStageInput = { ...stageOutput };
					nextStageInput.pipelineInput = { ...inputData[pipelineConnectionIds.pipelineInput] };
				}
			}

			const { pipelineInput, ...result } = nextStageInput;

			outputs[pipelineConnectionIds.pipelineOutput] = {
				type: 'object',
				value: result,
			};
			outputs[pipelineConnectionIds.intermediateStageOutputs] = {
				type: 'object[]',
				value: intermediateStageLogsOut,
			};

			return outputs;
		},
	};

	const getPipelineGraphInputPortCount = (connections: NodeConnection[], prefix: string): number => {
		const inputConnections = connections.filter((connection) => connection.inputId.startsWith(prefix));

		return inputConnections.length;
	};

	const processPipelineStage = async (
		rivet: typeof Rivet,
		nodeInputs: {
			context: InternalProcessContext;
			nodeInputData: Inputs;
			enableCache: boolean;
		},
		stage: {
			stageInput: Record<string, unknown>;
			stageGraph: NodeGraph;
			stageGraphRef: {
				graphId: string;
				graphName: string;
			};
			stageIdentifier: string;
		},
		intermediateStageLogsOut: Record<string, unknown>[]
	): Promise<Outputs> => {
		const outputs: Outputs = {};
		const { stageInput, stageGraphRef, stageIdentifier, stageGraph } = stage;
		const { context, nodeInputData, enableCache } = nodeInputs;

		if (!stageGraphRef.graphId || !stageGraphRef.graphName || stageGraph == null) {
			outputs[pipelineConnectionIds.pipelineOutput] = {
				type: 'control-flow-excluded',
				value: undefined,
			};
			outputs[pipelineConnectionIds.error] = {
				type: 'string',
				value: `Graph reference is invalid for graph ${stageIdentifier}`,
			};
			return outputs;
		}

		if (typeof stageInput !== 'object' || stageInput == null || Array.isArray(stageInput)) {
			outputs[pipelineConnectionIds.pipelineOutput] = {
				type: 'control-flow-excluded',
				value: undefined,
			};
			outputs[pipelineConnectionIds.error] = {
				type: 'string',
				value: rivet.dedent`Input must be an object.  Each stage's input should match the prior stage's output shape.  Error: ${stageIdentifier}`,
			};
			return outputs;
		}

		// validate input items to make sure they have all  keys of the  graph's input ports
		const missingKeys = new Set<string>();
		const notDataValue = new Set<string>();
		const invalidInputs = validateGraphInput(rivet, stageInput, stageGraph, missingKeys, notDataValue);

		if (invalidInputs) {
			outputs[pipelineConnectionIds.pipelineOutput] = {
				type: 'control-flow-excluded',
				value: undefined,
			};
			let errorMessage = `Input validation error for ${stageIdentifier}: `;
			if (missingKeys.size > 0) {
				errorMessage += `Missing inputs required for graph: ${Array.from(missingKeys)
					.map((key) => key)
					.join('; ')}`;
			}
			if (notDataValue.size > 0) {
				errorMessage += rivet.dedent`Invalid Inputs, make sure each input item is a ObjectDataValue::
				${Array.from(notDataValue)
					.map((value) => stringify(value))
					.join('; ')}`;
			}
			outputs[pipelineConnectionIds.error] = {
				type: 'string',
				value: errorMessage,
			};
			return outputs;
		}

		const aborted = context.signal.aborted;

		/**
		 * Execute the graph
		 */
		try {
			if (!aborted) {
				console.log(`Pipeline Node ${stageIdentifier}: Running graph ${stageGraphRef.graphName}`);
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

				const graphDataValue: GraphReferenceValue = {
					type: 'graph-reference',
					value: {
						graphId: stageGraphRef.graphId as GraphId,
						graphName: stageGraphRef.graphName,
					},
				};
				const stageGraphInputs: Inputs = {
					[callGraphConnectionIds.graph]: graphDataValue,
					[callGraphConnectionIds.inputs]: stageGraphInputDataValue,
				};

				/**
				 * Setup cache storage for the graph
				 */
				const graphRevalidationDigest = await createGraphDigest([stageGraph]);
				const cacheNamespace = stageGraphRef.graphId as string;
				const cacheStorage = getCacheStorageForNamespace(cacheNamespace, graphRevalidationDigest);

				let graphOutput: Outputs | null = null;
				if (enableCache) {
					/**
					 * Check if the item is in the cache
					 */
					const cacheKey = await createDigest(stringify(stageGraphInputs));
					const cachedValue = await getCachedItem<Outputs>(cacheStorage, cacheKey);

					if (cachedValue != null) {
						await sleep(10);
						graphOutput = cachedValue;
					}
				}

				if (graphOutput == null) {
					graphOutput = await impl.process(stageGraphInputs, context);
				}

				if (enableCache) {
					/**
					 * Set the item in the cache
					 */
					const cacheKey = await createDigest(stringify(stageGraphInputs));
					setCachedItem(cacheStorage, cacheKey, graphOutput);
				}
				const nextStageInput = rivet.coerceType(graphOutput[callGraphConnectionIds.outputs], 'object');
				intermediateStageLogsOut.push({
					identifier: stageIdentifier,
					graphName: stageGraphRef.graphName,
					graphOutput: nextStageInput,
					graphInput: stageInput,
				});

				outputs[pipelineConnectionIds.pipelineOutput] = {
					type: 'object',
					value: nextStageInput,
				};
				outputs[pipelineConnectionIds.intermediateStageOutputs] = {
					type: 'object[]',
					value: intermediateStageLogsOut,
				};
				return outputs;
			}
			/**
			 * If aborted then
			 */
			outputs[pipelineConnectionIds.pipelineOutput] = {
				type: 'control-flow-excluded',
				value: undefined,
			};
			outputs[pipelineConnectionIds.error] = {
				type: 'string',
				value: `Aborted ${stageGraphRef.graphName}`,
			};
			return outputs;
		} catch (err) {
			outputs[pipelineConnectionIds.pipelineOutput] = {
				type: 'control-flow-excluded',
				value: undefined,
			};

			outputs[pipelineConnectionIds.pipelineOutput] = {
				type: 'string',
				value: rivet.dedent`Error running graph ${stageGraphRef.graphName}.
				Message::: ${rivet.getError(err).message}
				Input::: JSON ${JSON.stringify(stageInput, null, 2)}
				`,
			};
			return outputs;
		}
	};

	// Once a node is defined, you must pass it to rivet.pluginNodeDefinition, which will return a valid
	// PluginNodeDefinition object.
	const pipelineNode = rivet.pluginNodeDefinition(pipelineNodeImpl, 'Pipeline Node');

	// This definition should then be used in the `register` function of your plugin definition.
	return pipelineNode;
}
