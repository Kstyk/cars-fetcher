import { z } from 'zod';

export const updateUserSchema = z
  .object({
    role: z.enum(['user', 'admin']).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((v) => v.role !== undefined || v.isActive !== undefined, {
    message: 'Podaj przynajmniej jedno pole do zmiany',
  });

export const userIdParam = z.object({ id: z.string().uuid() });
export const hostParam = z.object({ host: z.string().min(1).max(255) });
export const runsQuery = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;
