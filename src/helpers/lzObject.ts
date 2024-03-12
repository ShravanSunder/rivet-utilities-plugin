import * as LZString from "lz-string";

/**
 * Function to compress an object
 * @param obj
 * @returns
 */
export const compressObject = <T>(obj: T): string => {
  try {
    const jsonString = JSON.stringify(obj);
    return LZString.compressToUTF16(jsonString);
  } catch (error) {
    console.error("Error compressing object:", error);
    throw error;
  }
};
/**
 * Function to decompress an object
 * @param compressedData
 * @returns
 */
export const decompressObject = <T>(compressedData: string): T => {
  try {
    const decompressed = LZString.decompressFromUTF16(compressedData);
    if (!decompressed) {
      throw new Error("Decompression returned null or undefined.");
    }
    return JSON.parse(decompressed) as T;
  } catch (error) {
    console.error("Error decompressing object:", error);
    throw error;
  }
};
