import { router } from "./init";
import { uploadsRouter } from "./routers/uploads";
import { usersRouter } from "./routers/users";

export const appRouter = router({
  users: usersRouter,
  uploads: uploadsRouter,
});

export type AppRouter = typeof appRouter;
