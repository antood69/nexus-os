import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Plus, GitBranch, Play, Pause, Trash2 } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Workflow } from "@shared/schema";

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
    draft: "bg-muted text-muted-foreground border-border",
    paused: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20",
    completed: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  };
  return (
    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium capitalize border ${styles[status] || styles.draft}`}>
      {status}
    </span>
  );
}

export default function WorkflowsPage() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");

  const { data: workflows, isLoading } = useQuery<Workflow[]>({ queryKey: ["/api/workflows"] });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/workflows", { name, description, priority });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workflows"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      setOpen(false);
      setName("");
      setDescription("");
      setPriority("medium");
      toast({ title: "Workflow created" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const next = status === "active" ? "paused" : "active";
      await apiRequest("PATCH", `/api/workflows/${id}`, { status: next });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workflows"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/workflows/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workflows"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({ title: "Workflow deleted" });
    },
  });

  return (
    <div className="p-6 space-y-5 max-w-[1200px]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold" data-testid="text-page-title">Workflows</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Create and manage orchestration workflows</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-workflow" className="gap-2">
              <Plus className="w-4 h-4" />
              New Workflow
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle>Create Workflow</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }}
              className="space-y-4 pt-2"
            >
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Name</label>
                <Input
                  data-testid="input-workflow-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Blog Post Pipeline"
                  required
                  className="bg-background border-border"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Description</label>
                <Textarea
                  data-testid="input-workflow-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What does this workflow do?"
                  className="bg-background border-border min-h-[80px]"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Priority</label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger data-testid="select-workflow-priority" className="bg-background border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                data-testid="button-submit-workflow"
                type="submit"
                className="w-full"
                disabled={!name.trim() || createMutation.isPending}
              >
                {createMutation.isPending ? "Creating..." : "Create Workflow"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Workflow cards grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-32 rounded-lg bg-card animate-pulse border border-border" />
          ))}
        </div>
      ) : !workflows?.length ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <GitBranch className="w-12 h-12 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground mb-1">No workflows yet</p>
          <p className="text-xs text-muted-foreground">Click "New Workflow" to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {workflows.map((w) => (
            <div
              key={w.id}
              data-testid={`card-workflow-${w.id}`}
              className="rounded-lg border border-border bg-card p-4 bunz-card-hover transition-all"
            >
              <div className="flex items-start justify-between mb-3">
                <Link href={`/workflows/${w.id}`}>
                  <h3 className="text-sm font-medium hover:text-primary cursor-pointer transition-colors">{w.name}</h3>
                </Link>
                <StatusBadge status={w.status} />
              </div>
              {w.description && (
                <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{w.description}</p>
              )}
              <div className="flex items-center justify-between">
                <span className={`text-[11px] px-2 py-0.5 rounded-full ${
                  w.priority === "critical" ? "bg-red-500/15 text-red-400"
                  : w.priority === "high" ? "bg-orange-500/15 text-orange-400"
                  : "bg-muted text-muted-foreground"
                }`}>{w.priority}</span>
                <div className="flex items-center gap-1">
                  <button
                    data-testid={`button-toggle-workflow-${w.id}`}
                    onClick={() => toggleMutation.mutate({ id: w.id, status: w.status })}
                    className="p-1.5 rounded-md hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
                  >
                    {w.status === "active" ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    data-testid={`button-delete-workflow-${w.id}`}
                    onClick={() => deleteMutation.mutate(w.id)}
                    className="p-1.5 rounded-md hover:bg-destructive/15 transition-colors text-muted-foreground hover:text-red-400"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
