import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { processJob } from "@/lib/jobs/process-job";

const bodySchema = z.object({ jobId: z.string().uuid() });

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const body = bodySchema.parse(await req.json());
  after(() => processJob(body.jobId));
  return Response.json({ started: true });
}

function after(fn: () => Promise<void>) {
  fn().catch((err) => console.error("processJob failed", err));
}
