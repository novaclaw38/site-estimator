import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { z } from "zod";
import { R2_BUCKET_NAME, r2Client } from "@/lib/r2/client";
import { protectedProcedure, router } from "../init";

export const uploadsRouter = router({
  presign: protectedProcedure
    .input(
      z.object({ fileName: z.string().min(1), contentType: z.string().min(1) }),
    )
    .mutation(async ({ ctx, input }) => {
      const objectKey = `jobs/${ctx.userId}/${crypto.randomUUID()}-${input.fileName}`;
      const command = new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: objectKey,
        ContentType: input.contentType,
      });
      const uploadUrl = await getSignedUrl(r2Client, command, {
        expiresIn: 300,
      });
      return { uploadUrl, objectKey };
    }),
});
