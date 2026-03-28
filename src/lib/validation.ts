import type { z, ZodType } from "zod";

import { AppError } from "./app-error.js";

export function parseInput<TSchema extends ZodType>(
  schema: TSchema,
  input: unknown,
): z.infer<TSchema> {
  const parsed = schema.safeParse(input);

  if (!parsed.success) {
    throw new AppError(400, "Request validation failed", parsed.error.flatten());
  }

  return parsed.data;
}
