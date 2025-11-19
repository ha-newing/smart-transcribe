import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "convex/react";
import { useTranslation } from "react-i18next";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, FileAudio, Users, Sparkles } from "lucide-react";

export default function TranscriptDetailPage() {
  const { fileId } = useParams<{ fileId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const transcript = useQuery(
    api.transcripts.getByFileIdPublic,
    fileId ? { fileId: fileId as Id<"files"> } : "skip"
  );

  const file = useQuery(
    api.files.get,
    fileId ? { fileId: fileId as Id<"files"> } : "skip"
  );

  const project = useQuery(
    api.projects.get,
    transcript ? { projectId: transcript.projectId } : "skip"
  );

  if (transcript === undefined || file === undefined) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Loading transcript...</div>
      </div>
    );
  }

  if (transcript === null || file === null) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <h2 className="text-2xl font-bold mb-2">Transcript not found</h2>
        <p className="text-muted-foreground mb-4">
          This file may not have been transcribed yet.
        </p>
        <Button onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
      </div>

      {/* File Info Card */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <FileAudio className="w-6 h-6 text-muted-foreground mt-1" />
              <div>
                <CardTitle className="text-2xl">{file.name}</CardTitle>
                {project && (
                  <CardDescription className="mt-1">
                    Project: {project.name}
                  </CardDescription>
                )}
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Speakers */}
      {transcript.speakers && transcript.speakers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Speakers ({transcript.speakers.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {transcript.speakers.map((speaker, idx) => (
                <div key={idx} className="px-3 py-1 bg-muted rounded-full text-sm">
                  {speaker}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Structured Text */}
      {transcript.structuredText && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              Structured Transcript
            </CardTitle>
            <CardDescription>AI-processed and cleaned version</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="prose dark:prose-invert max-w-none">
              <div className="whitespace-pre-wrap bg-muted p-4 rounded-lg">
                {transcript.structuredText}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Raw Transcript */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileAudio className="w-5 h-5" />
            Raw Transcript
          </CardTitle>
          <CardDescription>Original transcription from Soniox</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="prose dark:prose-invert max-w-none">
            <pre className="whitespace-pre-wrap bg-muted p-4 rounded-lg font-mono text-sm">
              {transcript.rawText}
            </pre>
          </div>
        </CardContent>
      </Card>

      {/* Status Card */}
      <Card>
        <CardHeader>
          <CardTitle>Processing Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status:</span>
              <span className="font-medium">{transcript.status}</span>
            </div>
            {transcript.language && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Language:</span>
                <span className="font-medium">{transcript.language}</span>
              </div>
            )}
            {transcript.metadata?.model && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Model:</span>
                <span className="font-medium">{transcript.metadata.model}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
