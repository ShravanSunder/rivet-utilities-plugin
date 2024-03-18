import type { Rivet, NodeGraph } from '@ironclad/rivet-core';
import { isObjectDataValue, isAnyDataValue } from '../../helpers/dataValueHelpers';

/**
 * Validates the input item against the graph's input nodes.
 * @param rivet - The Rivet object.
 * @param item - The input item to validate.
 * @param graph - The NodeGraph object.
 * @param missingKeysOut - A set to store missing keys.
 * @param notDataValueOut - A set to store keys that are not DataValues.
 * @returns True if the input item is invalid, false otherwise.
 */
export const validateGraphInputItem = (
	rivet: typeof Rivet,
	item: Record<string, unknown>,
	graph: NodeGraph,
	missingKeysOut: Set<string>,
	notDataValueOut: Set<string>
) => {
	let itemKeys = Object.keys(item);
	if (isObjectDataValue(rivet, item)) {
		itemKeys = Object.keys(item.value);
	}

	let itemValues = Object.values(item);
	if (isObjectDataValue(rivet, item)) {
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
				missingKeysOut.add(key);
			}
		}
		return true;
	}

	const invalidData = itemValues.some((s: unknown) => {
		/**
		 * if the item values aren't DataValues, then the item is invalid
		 */
		const isDataType = isAnyDataValue(rivet, s);
		if (!isDataType) {
			/**
			 * save the key that isn't a DataValue
			 */
			notDataValueOut.add(s as string);
			return true;
		}
	});
	return invalidData;
};
