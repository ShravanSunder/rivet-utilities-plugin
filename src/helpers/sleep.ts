/**
 * Creates a promise that resolves after a given number of milliseconds, effectively pausing execution for that duration.
 * @param ms - The number of milliseconds to wait before resolving the promise.
 * @returns Promise<void> A promise that resolves after the specified delay.
 */
export const sleep = (ms: number): Promise<void> => {
	return new Promise<void>((resolve) => setTimeout(resolve, ms));
};
