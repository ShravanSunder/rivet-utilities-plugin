import sha256 from 'crypto-js/sha256';
import { enc } from 'crypto-js';

export const createDigest = async (input: string) => {
	const hash = sha256(input);
	return hash.toString(enc.Hex);

	// const buffer = await crypto.subtle.digest(
	//   "SHA-256",
	//   new TextEncoder().encode(input)
	// );
	// const hexHash = Array.from(new Uint8Array(buffer))
	//   .map((byte) => byte.toString(16).padStart(2, "0"))
	//   .join("");
	// return hexHash;
};
