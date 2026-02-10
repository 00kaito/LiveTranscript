import { z } from 'zod';

export const api = {
  transcribe: {
    process: {
      method: 'POST' as const,
      path: '/api/transcribe' as const,
      // Input is FormData (not strictly typed in Zod for the body parser, but we can describe the expected fields)
      // We'll handle FormData parsing in the route handler.
      responses: {
        200: z.object({
          text: z.string(),
        }),
        400: z.object({
          message: z.string(),
        }),
        500: z.object({
          message: z.string(),
        }),
      },
    },
  },
};
