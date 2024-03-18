import type { ObjectDataValue, Rivet } from '@ironclad/rivet-core';

/**
 * Checks if the data is a DataValue
 * @param data
 * @returns
 */
// biome-ignore lint/suspicious/noExplicitAny: <explanation>
export const isAnyDataValue = (rivet: typeof Rivet, data: any): data is { type: string; value: any } => {
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
export const isObjectDataValue = (rivet: typeof Rivet, data: any): data is ObjectDataValue => {
	return typeof data === 'object' && data?.type === 'object' && typeof data?.value === 'object';
};
