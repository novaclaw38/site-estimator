import { router } from "./init";
import { jobsRouter } from "./routers/jobs";
import { quotesRouter } from "./routers/quotes";
import { uploadsRouter } from "./routers/uploads";
import { usersRouter } from "./routers/users";

export const appRouter = router({
  users: usersRouter,
  uploads: uploadsRouter,
  jobs: jobsRouter,
  quotes: quotesRouter,
});

export type AppRouter = typeof appRouter;
