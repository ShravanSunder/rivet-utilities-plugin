import { z } from 'zod';
export const PineconeSparseVector = z.object({
	indices: z.array(z.number()),
	values: z.array(z.number()),
});

export type PineconeSparseVector = z.infer<typeof PineconeSparseVector>;
