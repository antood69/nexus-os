import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Plus, Bot, MessageSquare, Trash2 } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Agent, Workflow } from "@shared/schema";

const roleColors: Record<string, string> = {
  writer: "bg-blue-500/15 text-blue-400",
  coder: "bg-emerald-500/15 text-emerald-400",
  auditor: "bg-amber-500/15 text-amber-400",
  researcher: "bg-violet-500/15 text-violet-400",
  designer: "bg-pink-500/15 text-pink-400",
};

const roleIcons: Record<string, string> = {
  writer: "W",
  coder: "C",
  auditor: "A",
  researcher: "R",
  designer: "D",
};

export default function AgentsPage() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState("coder");
  const [model, setModel] = useState("claude-sonnet");
  const [workflowId, setWorkflowId] = useState<string>("");
  const [systemPrompt, setSystemPrompt] = useState("");

  const { data: agents, isLoading } = useQuery<Agent[]>({ queryKey: ["/api/agents"] });
  const { data: workflows } = useQuery<Workflow[]>({ queryKey: ["/api/workflows"] });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/agents", {
        name,
        role,
        model,
        workflowId: workflowId ? Number(workflowId) : null,
        systemPrompt: systemPrompt || null,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      setOpen(false);
      setName("");
      setRole("coder");
      setModel("claude-sonnet");
      setWorkflowId("");
      setSystemPrompt("");
      toast({ title: "Agent created" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/agents/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({ title: "Agent deleted" });
    },
  });

  return (
    <div className="p-6 space-y-5 max-w-[1200px]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold" data-testid="text-page-title">Agents</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Create AI agents and assign them to workflows</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-agent" className="gap-2">
              <Plus className="w-4 h-4" />
              New Agent
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle>Create Agent</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }}
              className="space-y-4 pt-2"
            >
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Name</label>
                <Input
                  data-testid="input-agent-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder='e.g. "CodeBot", "Copy Editor"'
                  required
                  className="bg-background border-border"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Role</label>
                  <Select value={role} onValueChange={setRole}>
                    <SelectTrigger data-testid="select-agent-role" className="bg-background border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      <SelectItem value="writer">Writer</SelectItem>
                      <SelectItem value="coder">Coder</SelectItem>
                      <SelectItem value="auditor">Auditor</SelectItem>
                      <SelectItem value="researcher">Researcher</SelectItem>
                      <SelectItem value="designer">Designer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Model</label>
                  <Select value={model} onValueChange={setModel}>
                    <SelectTrigger data-testid="select-agent-model" className="bg-background border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      <SelectItem value="claude-sonnet">Claude Sonnet</SelectItem>
                      <SelectItem value="claude-opus">Claude Opus</SelectItem>
                      <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                      <SelectItem value="perplexity">Perplexity</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Assign to Workflow</label>
                <Select value={workflowId} onValueChange={setWorkflowId}>
                  <SelectTrigger data-testid="select-agent-workflow" className="bg-background border-border">
                    <SelectValue placeholder="None (unassigned)" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="none">None (unassigned)</SelectItem>
                    {workflows?.map(w => (
                      <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">System Prompt</label>
                <Textarea
                  data-testid="input-agent-prompt"
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  placeholder="Instructions for this agent..."
                  className="bg-background border-border min-h-[80px]"
                />
              </div>
              <Button
                data-testid="button-submit-agent"
                type="submit"
                className="w-full"
                disabled={!name.trim() || createMutation.isPending}
              >
                {createMutation.isPending ? "Creating..." : "Create Agent"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Agent grid */}
      {isLoading ? (
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-36 rounded-lg bg-card animate-pulse border border-border" />
          ))}
        </div>
      ) : !agents?.length ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Bot className="w-12 h-12 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground mb-1">No agents yet</p>
          <p className="text-xs text-muted-foreground">Click "New Agent" to create your first AI worker</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {agents.map((a) => (
            <div
              key={a.id}
              data-testid={`card-agent-${a.id}`}
              className="rounded-lg border border-border bg-card p-4 nexus-card-hover transition-all"
            >
              <div className="flex items-start gap-3 mb-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold ${roleColors[a.role] || "bg-muted text-muted-foreground"}`}>
                  {roleIcons[a.role] || "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-medium truncate">{a.name}</h3>
                  <p className="text-xs text-muted-foreground capitalize">{a.role} · {a.model}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 mb-3">
                <span className={`inline-block w-2 h-2 rounded-full ${
                  a.status === "working" ? "bg-emerald-400 animate-pulse-glow"
                  : a.status === "error" ? "bg-red-400"
                  : "bg-muted-foreground"
                }`} />
                <span className="text-[11px] text-muted-foreground capitalize">{a.status}</span>
              </div>
              <div className="flex items-center justify-between">
                <Link href={`/agents/${a.id}/chat`}>
                  <button
                    data-testid={`button-chat-agent-${a.id}`}
                    className="flex items-center gap-1.5 text-xs text-primary hover:underline"
                  >
                    <MessageSquare className="w-3 h-3" />
                    Chat
                  </button>
                </Link>
                <button
                  data-testid={`button-delete-agent-${a.id}`}
                  onClick={() => deleteMutation.mutate(a.id)}
                  className="p-1.5 rounded-md hover:bg-destructive/15 transition-colors text-muted-foreground hover:text-red-400"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
