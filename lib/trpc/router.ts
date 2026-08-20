import { router } from "./init";
import { jobsRouter } from "./routers/jobs";
import { uploadsRouter } from "./routers/uploads";
import { usersRouter } from "./routers/users";

export const appRouter = router({
  users: usersRouter,
  uploads: uploadsRouter,
  jobs: jobsRouter,
});

export type AppRouter = typeof appRouter;
