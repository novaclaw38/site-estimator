import { currentUser } from "@clerk/nextjs/server";
import { getOrCreateUser } from "@/lib/auth/get-or-create-user";
import { protectedProcedure, router } from "../init";

export const usersRouter = router({
  me: protectedProcedure.query(async ({ ctx }) => {
    const clerkUser = await currentUser();
    return getOrCreateUser(
      ctx.userId,
      clerkUser?.primaryEmailAddress?.emailAddress ?? "",
      clerkUser?.firstName ?? null,
    );
  }),
});
