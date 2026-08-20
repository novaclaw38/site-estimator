import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";

export async function getOrCreateUser(
  clerkUserId: string,
  email: string,
  name: string | null,
) {
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.id, clerkUserId));
  if (existing[0]) return existing[0];

  const [created] = await db
    .insert(users)
    .values({ id: clerkUserId, email, name })
    .returning();
  if (!created) throw new Error("Failed to create user");
  return created;
}
