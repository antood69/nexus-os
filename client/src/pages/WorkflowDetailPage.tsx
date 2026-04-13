import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { ArrowLeft, Play, Pause, Plus, Bot, ListChecks, MessageSquare } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Workflow, Agent, Job } from "@shared/schema";

const roleColors: Record<string, string> = {
  writer: "bg-blue-500/15 text-blue-400",
  coder: "bg-emerald-500/15 text-emerald-400",
  auditor: "bg-amber-500/15 text-amber-400",
  researcher: "bg-violet-500/15 text-violet-400",
  designer: "bg-pink-500/15 text-pink-400",
};

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: "bg-emerald-400", working: "bg-emerald-400", completed: "bg-emerald-400",
    draft: "bg-muted-foreground", idle: "bg-muted-foreground", queued: "bg-yellow-400",
    paused: "bg-yellow-400", running: "bg-blue-400 animate-pulse-glow",
    error: "bg-red-400", failed: "bg-red-400",
  };
  return <span className={`inline-block w-2 h-2 rounded-full ${colors[status] || "bg-muted-foreground"}`} />;
}

export default function WorkflowDetailPage() {
  const { toast } = useToast();
  const [, params] = useRoute("/workflows/:id");
  const workflowId = Number(params?.id);
  const [jobOpen, setJobOpen] = useState(false);
  const [jobTitle, setJobTitle] = useState("");
  const [jobAgentId, setJobAgentId] = useState<string>("");

  const { data: workflow } = useQuery<Workflow>({
    queryKey: ["/api/workflows", workflowId],
  });

  const { data: wfAgents } = useQuery<Agent[]>({
    queryKey: ["/api/workflows", workflowId, "agents"],
  });

  const { data: wfJobs } = useQuery<Job[]>({
    queryKey: ["/api/workflows", workflowId, "jobs"],
  });

  const toggleMutation = useMutation({
    mutationFn: async () => {
      const next = workflow?.status === "active" ? "paused" : "active";
      await apiRequest("PATCH", `/api/workflows/${workflowId}`, { status: next });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workflows", workflowId] });
      queryClient.invalidateQueries({ queryKey: ["/api/workflows"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
    },
  });

  const createJobMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/jobs", {
        workflowId,
        agentId: jobAgentId ? Number(jobAgentId) : null,
        title: jobTitle,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workflows", workflowId, "jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      setJobOpen(false);
      setJobTitle("");
      setJobAgentId("");
      toast({ title: "Job added to queue" });
    },
  });

  if (!workflow) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5 max-w-[1200px]">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/workflows">
          <button data-testid="button-back" className="p-1.5 rounded-md hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" />
          </button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold" data-testid="text-workflow-name">{workflow.name}</h1>
            <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium capitalize ${
              workflow.status === "active" ? "bg-emerald-500/15 text-emerald-400"
              : workflow.status === "paused" ? "bg-yellow-500/15 text-yellow-400"
              : "bg-muted text-muted-foreground"
            }`}>{workflow.status}</span>
          </div>
          {workflow.description && <p className="text-sm text-muted-foreground mt-0.5">{workflow.description}</p>}
        </div>
        <Button
          data-testid="button-toggle-workflow"
          variant="outline"
          onClick={() => toggleMutation.mutate()}
          className="gap-2"
        >
          {workflow.status === "active" ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          {workflow.status === "active" ? "Pause" : "Start"}
        </Button>
      </div>

      <div className="grid grid-cols-5 gap-5">
        {/* Agents assigned */}
        <div className="col-span-2 rounded-lg border border-border bg-card">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h2 className="text-sm font-medium flex items-center gap-2">
              <Bot className="w-4 h-4 text-muted-foreground" />
              Agents ({wfAgents?.length || 0})
            </h2>
          </div>
          {!wfAgents?.length ? (
            <div className="p-6 text-center">
              <p className="text-xs text-muted-foreground">No agents assigned</p>
              <Link href="/agents">
                <button className="mt-2 text-xs text-primary hover:underline">Assign agents</button>
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {wfAgents.map(a => (
                <div key={a.id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className={`w-7 h-7 rounded-md flex items-center justify-center text-[10px] font-bold ${roleColors[a.role] || "bg-muted"}`}>
                    {a.role[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{a.name}</p>
                    <p className="text-[11px] text-muted-foreground capitalize">{a.role}</p>
                  </div>
                  <StatusDot status={a.status} />
                  <Link href={`/agents/${a.id}/chat`}>
                    <MessageSquare className="w-3.5 h-3.5 text-muted-foreground hover:text-primary cursor-pointer" />
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Jobs */}
        <div className="col-span-3 rounded-lg border border-border bg-card">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h2 className="text-sm font-medium flex items-center gap-2">
              <ListChecks className="w-4 h-4 text-muted-foreground" />
              Jobs ({wfJobs?.length || 0})
            </h2>
            <Dialog open={jobOpen} onOpenChange={setJobOpen}>
              <DialogTrigger asChild>
                <button data-testid="button-add-job" className="text-xs text-primary flex items-center gap-1 hover:underline">
                  <Plus className="w-3 h-3" /> Add Job
                </button>
              </DialogTrigger>
              <DialogContent className="bg-card border-border">
                <DialogHeader>
                  <DialogTitle>Add Job</DialogTitle>
                </DialogHeader>
                <form onSubmit={(e) => { e.preventDefault(); createJobMutation.mutate(); }} className="space-y-4 pt-2">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Title</label>
                    <Input
                      data-testid="input-job-title"
                      value={jobTitle}
                      onChange={(e) => setJobTitle(e.target.value)}
                      placeholder='e.g. "Write intro paragraph"'
                      required
                      className="bg-background border-border"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Assign to Agent</label>
                    <Select value={jobAgentId} onValueChange={setJobAgentId}>
                      <SelectTrigger className="bg-background border-border">
                        <SelectValue placeholder="Auto-assign" />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border">
                        <SelectItem value="auto">Auto-assign</SelectItem>
                        {wfAgents?.map(a => (
                          <SelectItem key={a.id} value={String(a.id)}>{a.name} ({a.role})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button data-testid="button-submit-job" type="submit" className="w-full" disabled={!jobTitle.trim() || createJobMutation.isPending}>
                    {createJobMutation.isPending ? "Adding..." : "Add Job"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
          {!wfJobs?.length ? (
            <div className="p-8 text-center">
              <ListChecks className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">No jobs yet — add one to get started</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {wfJobs.map(j => (
                <div key={j.id} data-testid={`job-row-${j.id}`} className="flex items-center gap-3 px-4 py-2.5">
                  <StatusDot status={j.status} />
                  <span className="text-sm flex-1 truncate">{j.title}</span>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full capitalize ${
                    j.status === "completed" ? "bg-emerald-500/15 text-emerald-400"
                    : j.status === "running" ? "bg-blue-500/15 text-blue-400"
                    : j.status === "failed" ? "bg-red-500/15 text-red-400"
                    : "bg-muted text-muted-foreground"
                  }`}>{j.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
