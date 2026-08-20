"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";

type Props = {
  onFileReady: (file: File) => void;
};

export function MediaRecorder({ onFileReady }: Props) {
  const [recording, setRecording] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<globalThis.MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function startRecording() {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });
    streamRef.current = stream;
    chunksRef.current = [];
    const recorder = new window.MediaRecorder(stream, {
      mimeType: "video/webm",
    });
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "video/webm" });
      const file = new File([blob], `recording-${Date.now()}.webm`, {
        type: "video/webm",
      });
      setPreviewUrl(URL.createObjectURL(blob));
      onFileReady(file);
      for (const track of stream.getTracks()) {
        track.stop();
      }
    };
    recorderRef.current = recorder;
    recorder.start();
    setRecording(true);
  }

  function stopRecording() {
    recorderRef.current?.stop();
    setRecording(false);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreviewUrl(URL.createObjectURL(file));
    onFileReady(file);
  }

  return (
    <div className="flex flex-col gap-[var(--space-3)]">
      <div className="flex gap-[var(--space-2)]">
        {!recording ? (
          <Button type="button" onClick={startRecording}>
            Record video
          </Button>
        ) : (
          <Button type="button" variant="secondary" onClick={stopRecording}>
            Stop recording
          </Button>
        )}
        <Button
          type="button"
          variant="secondary"
          onClick={() => fileInputRef.current?.click()}
        >
          Upload file
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*,audio/*,image/*"
          className="hidden"
          onChange={handleFileInput}
        />
      </div>
      {previewUrl && (
        // biome-ignore lint/a11y/useMediaCaption: local self-recorded preview, no caption track exists to provide
        <video
          src={previewUrl}
          controls
          className="max-w-md rounded-[var(--radius-md)]"
        />
      )}
    </div>
  );
}
