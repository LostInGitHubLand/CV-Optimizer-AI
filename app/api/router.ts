import { createRouter, publicQuery } from "./middleware";
import { cvRouter } from "./cv-router";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  cv: cvRouter,
});

export type AppRouter = typeof appRouter;
