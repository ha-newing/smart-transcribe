import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useAction } from "convex/react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Upload, FileAudio, Trash2, Play, RotateCw, Eye, MoreVertical } from "lucide-react";
import { PROJECT_STATUS, FILE_STATUS } from "@/constants/enums";
import FileUpload from "@/components/FileUpload";

export default function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const project = useQuery(
    api.projects.get,
    projectId ? { projectId: projectId as Id<"projects"> } : "skip"
  );

  const files = useQuery(
    api.files.listByProject,
    projectId ? { projectId: projectId as Id<"projects"> } : "skip"
  );

  const [showUpload, setShowUpload] = useState(false);

  const updateProject = useMutation(api.projects.update);
  const deleteProject = useMutation(api.projects.remove);
  const startTranscription = useAction(api.transcription.startTranscription);
  const resetForRetranscription = useMutation(api.files.resetForRetranscription);

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [transcribing, setTranscribing] = useState<Set<string>>(new Set());
  const [resetting, setResetting] = useState<Set<string>>(new Set());

  const handleEdit = () => {
    if (project) {
      setName(project.name);
      setDescription(project.description || "");
      setEditing(true);
    }
  };

  const handleSave = async () => {
    if (!projectId) return;

    try {
      await updateProject({
        projectId: projectId as Id<"projects">,
        name: name.trim(),
        description: description.trim() || undefined,
      });
      setEditing(false);
      toast.success("Project updated successfully");
    } catch (error) {
      console.error("Failed to update project:", error);
      toast.error("Failed to update project");
    }
  };

  const handleDelete = async () => {
    if (!projectId) return;
    if (!confirm("Are you sure you want to delete this project? This cannot be undone.")) {
      return;
    }

    try {
      await deleteProject({ projectId: projectId as Id<"projects"> });
      toast.success("Project deleted successfully");
      navigate("/projects");
    } catch (error) {
      console.error("Failed to delete project:", error);
      toast.error("Failed to delete project");
    }
  };

  const handleTranscribe = async (fileId: Id<"files">) => {
    setTranscribing((prev) => new Set(prev).add(fileId));
    try {
      await startTranscription({ fileId });
      toast.success("Transcription started! Check back soon for results.");
    } catch (error) {
      console.error("Failed to start transcription:", error);
      toast.error("Failed to start transcription. Please try again.");
    } finally {
      setTranscribing((prev) => {
        const next = new Set(prev);
        next.delete(fileId);
        return next;
      });
    }
  };

  const handleRetry = async (fileId: Id<"files">) => {
    if (!confirm("This will restart the transcription process. Continue?")) {
      return;
    }

    setResetting((prev) => new Set(prev).add(fileId));
    try {
      await resetForRetranscription({ fileId });
      // Automatically start transcription after reset
      setTranscribing((prev) => new Set(prev).add(fileId));
      await startTranscription({ fileId });
      toast.success("Transcription restarted! Check back soon for results.");
    } catch (error) {
      console.error("Failed to retry transcription:", error);
      toast.error("Failed to retry transcription. Please try again.");
    } finally {
      setResetting((prev) => {
        const next = new Set(prev);
        next.delete(fileId);
        return next;
      });
      setTranscribing((prev) => {
        const next = new Set(prev);
        next.delete(fileId);
        return next;
      });
    }
  };

  const getFileStatusColor = (status: string) => {
    switch (status) {
      case FILE_STATUS.COMPLETED:
        return "text-green-600 bg-green-50 dark:bg-green-900/20";
      case FILE_STATUS.TRANSCRIBING:
      case FILE_STATUS.PROCESSING:
        return "text-blue-600 bg-blue-50 dark:bg-blue-900/20";
      case FILE_STATUS.FAILED:
        return "text-red-600 bg-red-50 dark:bg-red-900/20";
      default:
        return "text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20";
    }
  };

  if (project === undefined) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Loading project...</div>
      </div>
    );
  }

  if (project === null) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <h2 className="text-2xl font-bold mb-2">Project not found</h2>
        <p className="text-muted-foreground mb-4">
          This project may have been deleted or you don't have access to it.
        </p>
        <Button onClick={() => navigate("/projects")}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Projects
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate("/projects")}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Projects
        </Button>
        <div className="flex gap-2">
          {!editing && (
            <>
              <Button variant="outline" onClick={handleEdit}>
                Edit
              </Button>
              <Button variant="destructive" onClick={handleDelete}>
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
            </>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          {editing ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Project Name</label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Project name"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Project description"
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSave}>Save</Button>
                <Button variant="outline" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between">
                <CardTitle className="text-2xl">{project.name}</CardTitle>
                <span
                  className={`text-xs px-2 py-1 rounded-full ${
                    project.status === PROJECT_STATUS.ACTIVE
                      ? "bg-green-100 text-green-800"
                      : "bg-gray-100 text-gray-800"
                  }`}
                >
                  {project.status}
                </span>
              </div>
              {project.description && (
                <CardDescription>{project.description}</CardDescription>
              )}
            </>
          )}
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Files</CardTitle>
            <Button onClick={() => setShowUpload(!showUpload)}>
              <Upload className="w-4 h-4 mr-2" />
              {showUpload ? "Hide Upload" : "Upload Files"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {showUpload && projectId && (
            <div className="mb-6">
              <FileUpload
                projectId={projectId as Id<"projects">}
                onUploadComplete={() => {
                  setShowUpload(false);
                }}
              />
            </div>
          )}
          {files === undefined ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading files...
            </div>
          ) : files.length === 0 ? (
            <div className="text-center py-12">
              <FileAudio className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No files yet</h3>
              <p className="text-muted-foreground mb-4">
                Upload audio or video files to transcribe
              </p>
              <Button onClick={() => setShowUpload(true)}>
                <Upload className="w-4 h-4 mr-2" />
                Upload Files
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {files.map((file) => (
                <div
                  key={file._id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <FileAudio className="w-5 h-5 text-muted-foreground" />
                    <div className="flex-1">
                      <div className="font-medium">{file.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                        {file.duration && ` • ${Math.floor(file.duration / 60)}:${String(Math.floor(file.duration % 60)).padStart(2, '0')}`}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {file.status === FILE_STATUS.UPLOADED && (
                      <Button
                        size="sm"
                        onClick={() => handleTranscribe(file._id)}
                        disabled={transcribing.has(file._id)}
                      >
                        <Play className="w-4 h-4 mr-1" />
                        {transcribing.has(file._id) ? "Starting..." : "Transcribe"}
                      </Button>
                    )}
                    {file.status === FILE_STATUS.COMPLETED && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => navigate(`/transcripts/${file._id}`)}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          View
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRetry(file._id)}
                          disabled={resetting.has(file._id) || transcribing.has(file._id)}
                          title="Re-run transcription from scratch"
                        >
                          <RotateCw className="w-4 h-4 mr-1" />
                          {resetting.has(file._id) || transcribing.has(file._id) ? "Retrying..." : "Retry"}
                        </Button>
                      </>
                    )}
                    {file.status === FILE_STATUS.FAILED && (
                      <Button
                        size="sm"
                        onClick={() => handleRetry(file._id)}
                        disabled={resetting.has(file._id) || transcribing.has(file._id)}
                      >
                        <RotateCw className="w-4 h-4 mr-1" />
                        {resetting.has(file._id) || transcribing.has(file._id) ? "Retrying..." : "Retry"}
                      </Button>
                    )}
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${getFileStatusColor(file.status)}`}
                    >
                      {file.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
