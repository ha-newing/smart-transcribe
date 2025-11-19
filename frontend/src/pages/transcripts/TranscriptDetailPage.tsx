import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useAction } from "convex/react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, FileAudio, Users, Sparkles, RefreshCw, BookOpen } from "lucide-react";
import { TRANSCRIPTION_STATUS } from "@/constants/enums";

export default function TranscriptDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [processingAI, setProcessingAI] = useState(false);

  // Try to get transcript by ID first (for combined transcripts)
  const transcriptById = useQuery(
    api.transcripts.getTranscript,
    id ? { transcriptId: id as Id<"transcripts"> } : "skip"
  );

  // If not found, try to get by fileId (for individual file transcripts)
  const transcriptByFile = useQuery(
    api.transcripts.getByFileIdPublic,
    id && !transcriptById ? { fileId: id as Id<"files"> } : "skip"
  );

  const transcript = transcriptById || transcriptByFile;

  // Get file info if this is an individual file transcript
  const file = useQuery(
    api.files.get,
    transcript && transcript.fileId ? { fileId: transcript.fileId } : "skip"
  );

  const project = useQuery(
    api.projects.get,
    transcript ? { projectId: transcript.projectId } : "skip"
  );

  const chapters = useQuery(
    api.chapters.listByTranscript,
    transcript ? { transcriptId: transcript._id } : "skip"
  );

  const retryAIProcessing = useAction(api.transcription.retryAIProcessing);

  const isCombined = transcript?.isCombined === true;

  const handleRetryAIProcessing = async () => {
    if (!transcript) return;

    if (!confirm("This will re-run AI processing (Gemini) to generate structured text, chapters, and speakers. Continue?")) {
      return;
    }

    setProcessingAI(true);
    try {
      await retryAIProcessing({ transcriptId: transcript._id });
      toast.success("AI processing started! The page will update automatically when complete.");
    } catch (error) {
      console.error("Failed to process with AI:", error);
      toast.error("Failed to start AI processing. Check console for details.");
    } finally {
      setProcessingAI(false);
    }
  };

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
        <div className="flex gap-2">
          {transcript && (!transcript.structuredText || transcript.status === TRANSCRIPTION_STATUS.FAILED) && (
            <Button
              onClick={handleRetryAIProcessing}
              disabled={processingAI}
              variant={transcript.status === TRANSCRIPTION_STATUS.FAILED ? "default" : "outline"}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${processingAI ? 'animate-spin' : ''}`} />
              {processingAI ? "Processing..." : "Retry AI Processing"}
            </Button>
          )}
        </div>
      </div>

      {/* File/Project Info Card */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <FileAudio className="w-6 h-6 text-muted-foreground mt-1" />
              <div>
                <CardTitle className="text-2xl">
                  {isCombined ? transcript.title || "Combined Conference Transcript" : file?.name || "Transcript"}
                </CardTitle>
                {project && (
                  <CardDescription className="mt-1">
                    Project: {project.name}
                    {isCombined && transcript.fileIds && (
                      <> • {transcript.fileIds.length} files combined</>
                    )}
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

      {/* Chapters */}
      {chapters && chapters.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5" />
              Chapters ({chapters.length})
            </CardTitle>
            <CardDescription>AI-generated sections from the transcript</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {chapters.map((chapter, idx) => (
                <div key={chapter._id} className="border-l-4 border-primary pl-4">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="font-semibold text-lg">
                      {idx + 1}. {chapter.title}
                    </h3>
                    {chapter.startTime !== undefined && chapter.endTime !== undefined && (
                      <div className="text-xs text-muted-foreground whitespace-nowrap">
                        {Math.floor(chapter.startTime / 60)}:{String(Math.floor(chapter.startTime % 60)).padStart(2, '0')}
                        {' - '}
                        {Math.floor(chapter.endTime / 60)}:{String(Math.floor(chapter.endTime % 60)).padStart(2, '0')}
                      </div>
                    )}
                  </div>
                  {chapter.speaker && (
                    <div className="text-sm text-muted-foreground mb-2">
                      Speaker: {chapter.speaker}
                    </div>
                  )}
                  <div className="text-sm whitespace-pre-wrap bg-muted/50 p-3 rounded">
                    {chapter.content}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Type: {chapter.type}
                  </div>
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
