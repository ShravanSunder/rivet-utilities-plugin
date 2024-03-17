import { z } from 'zod';
export const pineconeSparseVectorSchema = z.object({
	indices: z.array(z.number()),
	values: z.array(z.number()),
});

export type PineconeSparseVector = z.infer<typeof pineconeSparseVectorSchema>;
