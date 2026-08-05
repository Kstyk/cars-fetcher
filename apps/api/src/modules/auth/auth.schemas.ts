import { z } from 'zod';

const password = z
  .string()
  .min(8, 'Hasło musi mieć co najmniej 8 znaków')
  .max(128, 'Hasło jest za długie')
  .regex(/[a-z]/, 'Hasło musi zawierać małą literę')
  .regex(/[A-Z]/, 'Hasło musi zawierać wielką literę')
  .regex(/\d/, 'Hasło musi zawierać cyfrę');

export const registerSchema = z.object({
  email: z.string().email('Nieprawidłowy adres e-mail').max(320),
  password,
  firstName: z.string().trim().min(2, 'Imię jest wymagane').max(100),
  lastName: z.string().trim().min(2, 'Nazwisko jest wymagane').max(100),
});

export const loginSchema = z.object({
  email: z.string().email('Nieprawidłowy adres e-mail'),
  password: z.string().min(1, 'Hasło jest wymagane'),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1).optional(),
});

export const updateProfileSchema = z.object({
  firstName: z.string().trim().min(2).max(100).optional(),
  lastName: z.string().trim().min(2).max(100).optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Podaj obecne hasło'),
  newPassword: password,
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
