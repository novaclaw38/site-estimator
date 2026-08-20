import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { jobs } from "@/lib/db/schema";
import { protectedProcedure, router } from "../init";

export const jobsRouter = router({
  create: protectedProcedure
    .input(z.object({ mediaKeys: z.array(z.string().min(1)).min(1) }))
    .mutation(async ({ ctx, input }) => {
      const [job] = await db
        .insert(jobs)
        .values({ userId: ctx.userId, mediaKeys: input.mediaKeys })
        .returning();
      if (!job) throw new Error("Failed to create job");
      return job;
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    return db
      .select()
      .from(jobs)
      .where(eq(jobs.userId, ctx.userId))
      .orderBy(desc(jobs.createdAt));
  }),

  byId: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const rows = await db.select().from(jobs).where(eq(jobs.id, input.id));
      const job = rows[0];
      if (!job || job.userId !== ctx.userId) throw new Error("Job not found");
      return job;
    }),
});
