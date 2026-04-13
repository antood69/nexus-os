import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import {
  ArrowLeft, Play, Bot, MessageSquare,
  Loader2, CheckCircle2, XCircle, AlertTriangle, Coins, Square,
  Zap, Search, Code, PenLine, ShieldCheck, BarChart2, ChevronDown, ChevronUp, Clock
} from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Workflow, Agent } from "@shared/schema";

// ── Types ─────────────────────────────────────────────────────────────────────

interface WorkflowRun {
  id: number;
  workflowId: number;
  userId: number;
  status: string; // pending | running | paused | completed | failed | killed
  executionMode: string;
  inputData: string | null; // JSON
  finalOutput: string | null;
  totalTokensUsed: number;
  error: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

interface AgentExecution {
  id: number;
  runId: number;
  agentId: number | null;
  workerType: string; // boss | researcher | coder | writer | reviewer | analyst
  status: string; // pending | running | completed | failed | skipped
  inputPayload: string | null; // JSON
  output: string | null;
  modelUsed: string | null;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  error: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const WORKER_STYLES: Record<string, { color: string; bgColor: string; label: string; icon: React.ComponentType<{ className?: string }> }> = {
  boss: { color: "text-primary", bgColor: "bg-primary/15", label: "Boss Agent", icon: Zap },
  researcher: { color: "text-violet-400", bgColor: "bg-violet-500/15", label: "Researcher", icon: Search },
  coder: { color: "text-emerald-400", bgColor: "bg-emerald-500/15", label: "Coder", icon: Code },
  writer: { color: "text-blue-400", bgColor: "bg-blue-500/15", label: "Writer", icon: PenLine },
  reviewer: { color: "text-amber-400", bgColor: "bg-amber-500/15", label: "Reviewer", icon: ShieldCheck },
  analyst: { color: "text-sky-400", bgColor: "bg-sky-500/15", label: "Analyst", icon: BarChart2 },
};

const roleColors: Record<string, string> = {
  writer: "bg-blue-500/15 text-blue-400",
  coder: "bg-emerald-500/15 text-emerald-400",
  auditor: "bg-amber-500/15 text-amber-400",
  researcher: "bg-violet-500/15 text-violet-400",
  designer: "bg-pink-500/15 text-pink-400",
};

// ── Helper Components ─────────────────────────────────────────────────────────

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: "bg-emerald-400",
    working: "bg-emerald-400",
    completed: "bg-emerald-400",
    draft: "bg-muted-foreground",
    idle: "bg-muted-foreground",
    queued: "bg-yellow-400",
    paused: "bg-yellow-400",
    running: "bg-blue-400 animate-pulse",
    error: "bg-red-400",
    failed: "bg-red-400",
  };
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full ${colors[status] || "bg-muted-foreground"}`}
    />
  );
}

function RunStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20",
    running: "bg-blue-500/15 text-blue-400 border-blue-500/20",
    completed: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
    failed: "bg-red-500/15 text-red-400 border-red-500/20",
    killed: "bg-muted text-muted-foreground border-border",
    paused: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20",
  };
  return (
    <span
      className={`text-[11px] px-2 py-0.5 rounded-full font-medium capitalize border ${
        styles[status] || styles.pending
      }`}
    >
      {status}
    </span>
  );
}

function ExecutionStatusIcon({ status }: { status: string }) {
  if (status === "running") return <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />;
  if (status === "completed") return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
  if (status === "failed") return <XCircle className="w-4 h-4 text-red-400" />;
  if (status === "skipped") return <AlertTriangle className="w-4 h-4 text-muted-foreground" />;
  return <Clock className="w-4 h-4 text-yellow-400" />;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

function getTaskFromPayload(payload: string | null): string {
  if (!payload) return "";
  try {
    const p = JSON.parse(payload);
    return p.task || p.userPrompt || p.prompt || "";
  } catch {
    return "";
  }
}

// ── Execution Timeline Component ──────────────────────────────────────────────

function ExecutionTimeline({ executions }: { executions: AgentExecution[] }) {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const sorted = [...executions].sort((a, b) => a.id - b.id);

  return (
    <div className="space-y-0">
      {sorted.map((exec, idx) => {
        const style = WORKER_STYLES[exec.workerType] || WORKER_STYLES.boss;
        const Icon = style.icon;
        const task = getTaskFromPayload(exec.inputPayload);
        const isExpanded = expandedId === exec.id;
        const isLast = idx === sorted.length - 1;

        return (
          <div key={exec.id} className="flex gap-3">
            {/* Timeline line + icon */}
            <div className="flex flex-col items-center w-8 flex-shrink-0">
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center ${style.bgColor}`}
              >
                <Icon className={`w-4 h-4 ${style.color}`} />
              </div>
              {!isLast && <div className="w-px flex-1 bg-border min-h-[16px]" />}
            </div>

            {/* Content */}
            <div className={`flex-1 pb-4`}>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className={`text-xs font-medium ${style.color}`}>{style.label}</span>
                <ExecutionStatusIcon status={exec.status} />
                {exec.totalTokens > 0 && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                    {formatTokens(exec.totalTokens)} tokens
                  </Badge>
                )}
                {exec.modelUsed && (
                  <span className="text-[10px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">
                    {exec.modelUsed}
                  </span>
                )}
                {exec.startedAt && (
                  <span className="text-[10px] text-muted-foreground ml-auto">
                    {formatTime(exec.startedAt)}
                  </span>
                )}
              </div>

              {task && (
                <p className="text-xs text-muted-foreground mb-1 leading-relaxed">{task}</p>
              )}

              {exec.error && (
                <p className="text-xs text-red-400 bg-red-500/10 rounded px-2 py-1 mt-1">
                  {exec.error}
                </p>
              )}

              {exec.output && (
                <div className="mt-1">
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : exec.id)}
                    className="text-[11px] text-primary hover:underline flex items-center gap-1"
                  >
                    {isExpanded ? (
                      <ChevronUp className="w-3 h-3" />
                    ) : (
                      <ChevronDown className="w-3 h-3" />
                    )}
                    {isExpanded ? "Hide output" : "View output"}
                  </button>
                  {isExpanded && (
                    <div className="mt-2 rounded-lg border border-border bg-background/50 p-3 text-xs text-foreground whitespace-pre-wrap max-h-[300px] overflow-y-auto leading-relaxed">
                      {exec.output}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main Page Component ───────────────────────────────────────────────────────

export default function WorkflowDetailPage() {
  const { toast } = useToast();
  const [, params] = useRoute("/workflows/:id");
  const workflowId = Number(params?.id);
  const [runOpen, setRunOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("claude-sonnet");
  const [showHistory, setShowHistory] = useState(false);

  // Fetch workflow
  const { data: workflow } = useQuery<Workflow>({
    queryKey: ["/api/workflows", workflowId],
  });

  // Fetch agents assigned to workflow
  const { data: wfAgents } = useQuery<Agent[]>({
    queryKey: ["/api/workflows", workflowId, "agents"],
  });

  // Fetch latest run with polling when active
  const { data: latestRunData } = useQuery<{
    run: WorkflowRun;
    executions: AgentExecution[];
  } | null>({
    queryKey: ["latest-run", workflowId],
    queryFn: async () => {
      const res = await fetch(`/api/workflows/${workflowId}/latest-run`);
      if (!res.ok) return null;
      const data = await res.json();
      return data || null;
    },
    refetchInterval: (query) => {
      const data = query.state.data;
      if (
        data?.run?.status === "running" ||
        data?.run?.status === "pending"
      ) {
        return 2000;
      }
      return false;
    },
  });

  // Fetch all runs for history
  const { data: allRuns = [] } = useQuery<WorkflowRun[]>({
    queryKey: ["workflow-runs", workflowId],
    queryFn: async () => {
      const res = await fetch(`/api/workflows/${workflowId}/runs`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Start run mutation
  const startRunMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/workflows/${workflowId}/run`, {
        prompt,
        model,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["latest-run", workflowId] });
      queryClient.invalidateQueries({ queryKey: ["workflow-runs", workflowId] });
      queryClient.invalidateQueries({ queryKey: ["token-status"] });
      setRunOpen(false);
      setPrompt("");
      toast({ title: "Workflow run started" });
    },
    onError: (err: any) => {
      toast({
        title: "Error starting run",
        description: err.message || "Something went wrong",
        variant: "destructive",
      });
    },
  });

  // Kill run mutation
  const killRunMutation = useMutation({
    mutationFn: async (runId: number) => {
      await apiRequest("POST", `/api/runs/${runId}/kill`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["latest-run", workflowId] });
      queryClient.invalidateQueries({ queryKey: ["workflow-runs", workflowId] });
      toast({ title: "Run killed" });
    },
    onError: (err: any) => {
      toast({
        title: "Error killing run",
        description: err.message || "Something went wrong",
        variant: "destructive",
      });
    },
  });

  const latestRun = latestRunData?.run;
  const executions = latestRunData?.executions || [];
  const isRunActive =
    latestRun?.status === "running" || latestRun?.status === "pending";

  // Loading state
  if (!workflow) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5 max-w-[1200px]">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <Link href="/workflows">
          <button className="p-1.5 rounded-md hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" />
          </button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold">{workflow.name}</h1>
            <span
              className={`text-[11px] px-2 py-0.5 rounded-full font-medium capitalize ${
                workflow.status === "active"
                  ? "bg-emerald-500/15 text-emerald-400"
                  : workflow.status === "paused"
                  ? "bg-yellow-500/15 text-yellow-400"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {workflow.status}
            </span>
          </div>
          {workflow.description && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {workflow.description}
            </p>
          )}
        </div>

        {/* Run Workflow Dialog */}
        <Dialog open={runOpen} onOpenChange={setRunOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2" disabled={isRunActive}>
              {isRunActive ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Run Workflow
                </>
              )}
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Run Workflow</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                startRunMutation.mutate();
              }}
              className="space-y-4 pt-2"
            >
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  Prompt
                </label>
                <Textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder='e.g. "Research the top 5 AI agent platforms and write a comparison report"'
                  required
                  className="bg-background border-border min-h-[100px] resize-none"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  Model
                </label>
                <Select value={model} onValueChange={setModel}>
                  <SelectTrigger className="bg-background border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="claude-sonnet">
                      Claude Sonnet (recommended)
                    </SelectItem>
                    <SelectItem value="claude-opus">
                      Claude Opus (most capable)
                    </SelectItem>
                    <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                    <SelectItem value="perplexity">
                      Perplexity Sonar (web search)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="submit"
                className="w-full gap-2"
                disabled={!prompt.trim() || startRunMutation.isPending}
              >
                {startRunMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    Execute
                  </>
                )}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* ── Two-column layout ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-5 gap-5">
        {/* Left: Agents assigned (col-span-2) */}
        <div className="col-span-2 rounded-lg border border-border bg-card">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h2 className="text-sm font-medium flex items-center gap-2">
              <Bot className="w-4 h-4 text-muted-foreground" />
              Agents ({wfAgents?.length || 0})
            </h2>
          </div>
          {!wfAgents?.length ? (
            <div className="p-6 text-center">
              <Bot className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">No agents assigned</p>
              <Link href="/agents">
                <button className="mt-2 text-xs text-primary hover:underline">
                  Assign agents
                </button>
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {wfAgents.map((a) => (
                <div key={a.id} className="flex items-center gap-3 px-4 py-2.5">
                  <div
                    className={`w-7 h-7 rounded-md flex items-center justify-center text-[10px] font-bold ${
                      roleColors[a.role] || "bg-muted text-muted-foreground"
                    }`}
                  >
                    {a.role[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{a.name}</p>
                    <p className="text-[11px] text-muted-foreground capitalize">
                      {a.role}
                    </p>
                  </div>
                  <StatusDot status={a.status} />
                  <Link href={`/agents/${a.id}/chat`}>
                    <MessageSquare className="w-3.5 h-3.5 text-muted-foreground hover:text-primary cursor-pointer transition-colors" />
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Execution Panel (col-span-3) */}
        <div className="col-span-3 rounded-lg border border-border bg-card">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h2 className="text-sm font-medium flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" />
              Execution
            </h2>
            {latestRun && (
              <div className="flex items-center gap-2">
                <RunStatusBadge status={latestRun.status} />
                {latestRun.totalTokensUsed > 0 && (
                  <Badge
                    variant="outline"
                    className="text-[10px] px-1.5 py-0 h-4 gap-1"
                  >
                    <Coins className="w-2.5 h-2.5" />
                    {formatTokens(latestRun.totalTokensUsed)}
                  </Badge>
                )}
                {isRunActive && (
                  <Button
                    variant="destructive"
                    size="sm"
                    className="h-6 text-[10px] px-2 gap-1"
                    onClick={() => killRunMutation.mutate(latestRun.id)}
                    disabled={killRunMutation.isPending}
                  >
                    <Square className="w-2.5 h-2.5" />
                    Kill
                  </Button>
                )}
              </div>
            )}
          </div>

          <div className="p-4">
            {!latestRun ? (
              /* Empty state */
              <div className="py-12 text-center">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <Zap className="w-6 h-6 text-primary/60" />
                </div>
                <p className="text-sm text-muted-foreground mb-1">No runs yet</p>
                <p className="text-xs text-muted-foreground">
                  Click "Run Workflow" to start the orchestrator
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Input prompt */}
                {latestRun.inputData && (
                  <div className="rounded-lg bg-secondary/50 px-3 py-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Prompt:</span>{" "}
                    {(() => {
                      try {
                        const parsed = JSON.parse(latestRun.inputData);
                        return parsed.prompt || parsed.userPrompt || latestRun.inputData;
                      } catch {
                        return latestRun.inputData;
                      }
                    })()}
                  </div>
                )}

                {/* Execution Timeline */}
                {executions.length > 0 && (
                  <ExecutionTimeline executions={executions} />
                )}

                {/* Loading indicator if pending and no executions yet */}
                {isRunActive && executions.length === 0 && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground py-4">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    Starting orchestration...
                  </div>
                )}

                {/* Run error */}
                {latestRun.error && (
                  <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
                    <span className="font-medium">Error:</span> {latestRun.error}
                  </div>
                )}

                {/* Final Output */}
                {latestRun.finalOutput && latestRun.status === "completed" && (
                  <Card className="border-primary/20 bg-primary/5">
                    <CardContent className="pt-4 pb-4 px-4">
                      <div className="flex items-center gap-2 mb-3">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span className="text-sm font-medium text-foreground">
                          Final Output
                        </span>
                        {latestRun.completedAt && (
                          <span className="text-[10px] text-muted-foreground ml-auto">
                            {formatTime(latestRun.completedAt)}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-foreground whitespace-pre-wrap leading-relaxed max-h-[400px] overflow-y-auto">
                        {latestRun.finalOutput}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Run History ──────────────────────────────────────────────────────── */}
      {allRuns.length > 1 && (
        <div className="rounded-lg border border-border bg-card">
          <button
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-foreground hover:bg-secondary/50 transition-colors rounded-lg"
            onClick={() => setShowHistory(!showHistory)}
          >
            <span className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              Run History ({allRuns.length})
            </span>
            {showHistory ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            )}
          </button>
          {showHistory && (
            <div className="divide-y divide-border border-t border-border">
              {allRuns
                .slice()
                .sort(
                  (a, b) =>
                    new Date(b.createdAt).getTime() -
                    new Date(a.createdAt).getTime()
                )
                .map((run) => (
                  <div
                    key={run.id}
                    className="flex items-center gap-3 px-4 py-2.5 text-xs hover:bg-secondary/30 transition-colors"
                  >
                    <RunStatusBadge status={run.status} />
                    <span className="text-muted-foreground flex-1">
                      {run.startedAt
                        ? new Date(run.startedAt).toLocaleString("en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })
                        : new Date(run.createdAt).toLocaleString("en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                    </span>
                    {run.totalTokensUsed > 0 && (
                      <Badge
                        variant="outline"
                        className="text-[10px] px-1.5 py-0 h-4 gap-1"
                      >
                        <Coins className="w-2.5 h-2.5" />
                        {formatTokens(run.totalTokensUsed)}
                      </Badge>
                    )}
                    {run.executionMode && (
                      <span className="text-[10px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded capitalize">
                        {run.executionMode}
                      </span>
                    )}
                  </div>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
