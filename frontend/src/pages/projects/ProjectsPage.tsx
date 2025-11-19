import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, FolderOpen } from "lucide-react";
import { PROJECT_STATUS } from "@/constants/enums";

export default function ProjectsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const projects = useQuery(api.projects.list, {});
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sharedWithOrg, setSharedWithOrg] = useState(false);
  const [loading, setLoading] = useState(false);

  const createProject = useMutation(api.projects.create);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    try {
      const projectId = await createProject({
        name: name.trim(),
        description: description.trim() || undefined,
        sharedWithOrganization: sharedWithOrg,
      });

      setName("");
      setDescription("");
      setSharedWithOrg(false);
      setShowCreateForm(false);

      toast.success("Project created successfully!");

      // Navigate to the new project
      navigate(`/projects/${projectId}`);
    } catch (error) {
      console.error("Failed to create project:", error);
      toast.error("Failed to create project. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case PROJECT_STATUS.ACTIVE:
        return "text-green-600 bg-green-50 dark:bg-green-900/20";
      case PROJECT_STATUS.COMPLETED:
        return "text-blue-600 bg-blue-50 dark:bg-blue-900/20";
      case PROJECT_STATUS.ARCHIVED:
        return "text-gray-600 bg-gray-50 dark:bg-gray-900/20";
      default:
        return "text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t("nav.projects")}</h1>
          <p className="text-muted-foreground mt-1">
            Manage your transcription projects
          </p>
        </div>
        <Button onClick={() => setShowCreateForm(!showCreateForm)}>
          <Plus className="w-4 h-4 mr-2" />
          New Project
        </Button>
      </div>

      {showCreateForm && (
        <Card>
          <CardHeader>
            <CardTitle>Create New Project</CardTitle>
            <CardDescription>
              Create a project to organize your transcription files
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="name" className="text-sm font-medium">
                  Project Name *
                </label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="My Transcription Project"
                  required
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="description" className="text-sm font-medium">
                  Description
                </label>
                <Input
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Project description (optional)"
                  disabled={loading}
                />
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="sharedWithOrg"
                  checked={sharedWithOrg}
                  onChange={(e) => setSharedWithOrg(e.target.checked)}
                  disabled={loading}
                  className="rounded"
                />
                <label htmlFor="sharedWithOrg" className="text-sm">
                  Share with entire organization
                </label>
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={loading}>
                  {loading ? "Creating..." : "Create Project"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateForm(false)}
                  disabled={loading}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects === undefined ? (
          <div className="col-span-full text-center py-12 text-muted-foreground">
            Loading projects...
          </div>
        ) : projects.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <FolderOpen className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No projects yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first transcription project to get started
            </p>
            <Button onClick={() => setShowCreateForm(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Project
            </Button>
          </div>
        ) : (
          projects.map((project) => (
            <Card
              key={project._id}
              className="hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => navigate(`/projects/${project._id}`)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg">{project.name}</CardTitle>
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${getStatusColor(project.status)}`}
                  >
                    {project.status}
                  </span>
                </div>
                {project.description && (
                  <CardDescription className="line-clamp-2">
                    {project.description}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground">
                  {project.sharedWithOrganization ? (
                    <span>🌐 Shared with organization</span>
                  ) : (
                    <span>🔒 Private</span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
