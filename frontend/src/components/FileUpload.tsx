import { useState, useRef, useCallback } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Upload, X, FileAudio, CheckCircle, AlertCircle } from "lucide-react";

interface FileUploadProps {
  projectId: Id<"projects">;
  onUploadComplete?: () => void;
}

interface UploadingFile {
  file: File;
  progress: number;
  status: "uploading" | "success" | "error";
  error?: string;
}

export default function FileUpload({ projectId, onUploadComplete }: FileUploadProps) {
  const [uploadingFiles, setUploadingFiles] = useState<Map<string, UploadingFile>>(new Map());
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const createFile = useMutation(api.files.createFile);

  const uploadFile = useCallback(
    async (file: File) => {
      const fileId = `${file.name}-${Date.now()}`;

      setUploadingFiles((prev) => {
        const next = new Map(prev);
        next.set(fileId, {
          file,
          progress: 0,
          status: "uploading",
        });
        return next;
      });

      try {
        // Step 1: Generate upload URL
        const uploadUrl = await generateUploadUrl();

        // Step 2: Upload file to Convex storage
        const result = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": file.type },
          body: file,
        });

        if (!result.ok) {
          throw new Error("Failed to upload file");
        }

        const { storageId } = await result.json();

        // Step 3: Create file record in database
        await createFile({
          projectId,
          name: file.name,
          size: file.size,
          mimeType: file.type,
          storageId,
        });

        setUploadingFiles((prev) => {
          const next = new Map(prev);
          next.set(fileId, {
            file,
            progress: 100,
            status: "success",
          });
          return next;
        });

        // Remove from list after 2 seconds
        setTimeout(() => {
          setUploadingFiles((prev) => {
            const next = new Map(prev);
            next.delete(fileId);
            return next;
          });
        }, 2000);

        onUploadComplete?.();
      } catch (error) {
        console.error("Upload error:", error);
        setUploadingFiles((prev) => {
          const next = new Map(prev);
          next.set(fileId, {
            file,
            progress: 0,
            status: "error",
            error: error instanceof Error ? error.message : "Upload failed",
          });
          return next;
        });
      }
    },
    [projectId, generateUploadUrl, createFile, onUploadComplete]
  );

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files) return;

      Array.from(files).forEach((file) => {
        // Validate file type (audio/video)
        if (!file.type.startsWith("audio/") && !file.type.startsWith("video/")) {
          toast.error(`${file.name} is not an audio or video file`);
          return;
        }

        uploadFile(file);
      });
    },
    [uploadFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      handleFiles(e.target.files);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [handleFiles]
  );

  const removeFile = useCallback((fileId: string) => {
    setUploadingFiles((prev) => {
      const next = new Map(prev);
      next.delete(fileId);
      return next;
    });
  }, []);

  return (
    <div className="space-y-4">
      <Card
        className={`border-2 border-dashed transition-colors ${
          isDragging
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-primary/50"
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="p-8 text-center">
          <Upload
            className={`w-12 h-12 mx-auto mb-4 ${
              isDragging ? "text-primary" : "text-muted-foreground"
            }`}
          />
          <h3 className="text-lg font-medium mb-2">
            {isDragging ? "Drop files here" : "Upload audio or video files"}
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Drag and drop files here, or click to browse
          </p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="audio/*,video/*"
            onChange={handleFileSelect}
            className="hidden"
          />
          <Button onClick={() => fileInputRef.current?.click()}>
            <Upload className="w-4 h-4 mr-2" />
            Select Files
          </Button>
          <p className="text-xs text-muted-foreground mt-4">
            Supported formats: MP3, WAV, MP4, MOV, and more
          </p>
        </div>
      </Card>

      {uploadingFiles.size > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Uploading Files</h4>
          {Array.from(uploadingFiles.entries()).map(([fileId, uploadInfo]) => (
            <Card key={fileId} className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <FileAudio className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">
                      {uploadInfo.file.name}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {(uploadInfo.file.size / 1024 / 1024).toFixed(2)} MB
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {uploadInfo.status === "uploading" && (
                    <div className="text-sm text-muted-foreground">
                      Uploading...
                    </div>
                  )}
                  {uploadInfo.status === "success" && (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  )}
                  {uploadInfo.status === "error" && (
                    <>
                      <AlertCircle className="w-5 h-5 text-red-600" />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(fileId)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {uploadInfo.status === "uploading" && (
                <div className="mt-2 w-full bg-muted rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadInfo.progress}%` }}
                  />
                </div>
              )}

              {uploadInfo.status === "error" && uploadInfo.error && (
                <div className="mt-2 text-sm text-red-600">{uploadInfo.error}</div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
