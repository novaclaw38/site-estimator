"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { MediaRecorder } from "@/components/media-recorder";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { trpc } from "@/lib/trpc/client";

export default function NewJobPage() {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const presign = trpc.uploads.presign.useMutation();
  const createJob = trpc.jobs.create.useMutation();

  async function handleSubmit() {
    if (files.length === 0) return;
    setSubmitting(true);
    try {
      const mediaKeys: string[] = [];
      for (const file of files) {
        const { uploadUrl, objectKey } = await presign.mutateAsync({
          fileName: file.name,
          contentType: file.type,
        });
        await fetch(uploadUrl, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": file.type },
        });
        mediaKeys.push(objectKey);
      }
      const job = await createJob.mutateAsync({ mediaKeys });
      router.push(`/jobs/${job.id}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="mx-auto max-w-xl">
      <h1 className="font-display mb-[var(--space-3)] text-2xl">New job</h1>
      <MediaRecorder
        onFileReady={(file) => setFiles((prev) => [...prev, file])}
      />
      <p className="text-[var(--color-text-muted)] mt-[var(--space-2)] text-sm">
        {files.length} file(s) ready
      </p>
      <Button
        type="button"
        className="mt-[var(--space-3)]"
        disabled={files.length === 0 || submitting}
        onClick={handleSubmit}
      >
        {submitting ? "Uploading..." : "Generate quote"}
      </Button>
    </Card>
  );
}
