import React, { useState, useCallback, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import {
  ArrowLeft, Play, Bot, MessageSquare,
  Loader2, CheckCircle2, XCircle, AlertTriangle, Coins, Square,
  Zap, Search, Code, PenLine, ShieldCheck, BarChart2, ChevronDown, ChevronUp, Clock,
  Settings, Trash2, X, PanelRightClose, PanelRight, PanelBottomClose, PanelBottom,
  Brain, Pen, Shield, BarChart3, Crown, GitBranch, Merge, Timer, Repeat,
  Bell, File, Send, Workflow as WorkflowIcon, ArrowRight,
} from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Workflow, Agent } from "@shared/schema";
import type { Node, Edge } from "@xyflow/react";
import WorkflowCanvas from "@/components/WorkflowCanvas";
import NodePalette from "@/components/NodePalette";

// ── Types ─────────────────────────────────────────────────────────────────────

interface WorkflowRun {
  id: number;
  workflowId: number;
  userId: number;
  status: string;
  executionMode: string;
  inputData: string | null;
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
  workerType: string;
  status: string;
  inputPayload: string | null;
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

interface CanvasVersion {
  id: number;
  workflowId: number;
  label: string;
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
            <div className="flex-1 pb-4">
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

// ── Properties Panel ──────────────────────────────────────────────────────────

const NODE_TYPE_ICONS: Record<string, Record<string, React.ElementType>> = {
  trigger: { manual: Play, webhook: Zap, schedule: Clock, event: Bell },
  agent: { researcher: Brain, coder: Code, writer: Pen, reviewer: Shield, analyst: BarChart3, boss: Crown },
  logic: { if_else: GitBranch, switch: GitBranch, merge: Merge, delay: Timer, loop: Repeat },
  output: { return: ArrowRight, save_file: File, post: Send, trigger_workflow: WorkflowIcon },
};

const NODE_TYPE_COLORS: Record<string, string> = {
  trigger: "text-emerald-400",
  agent: "text-blue-400",
  logic: "text-purple-400",
  output: "text-teal-400",
};

function PropertiesPanel({
  node,
  onUpdate,
  onDelete,
  collapsed,
  onToggle,
}: {
  node: Node | null;
  onUpdate: (nodeId: string, data: Record<string, unknown>) => void;
  onDelete: (nodeId: string) => void;
  collapsed: boolean;
  onToggle: () => void;
}) {
  if (collapsed) {
    return (
      <div className="flex flex-col items-center py-2 border-l border-border">
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onToggle}>
          <PanelRight className="w-4 h-4" />
        </Button>
      </div>
    );
  }

  if (!node) {
    return (
      <div className="w-[280px] border-l border-border bg-card flex flex-col">
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
          <span className="text-xs font-medium text-foreground flex items-center gap-2">
            <Settings className="w-3.5 h-3.5 text-muted-foreground" />
            Properties
          </span>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onToggle}>
            <PanelRightClose className="w-3.5 h-3.5" />
          </Button>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-xs text-muted-foreground text-center">
            Select a node to view its properties.
          </p>
        </div>
      </div>
    );
  }

  const nodeType = node.type || "agent";
  const subtype = (node.data.subtype as string) || "";
  const iconMap = NODE_TYPE_ICONS[nodeType] || {};
  const Icon = iconMap[subtype] || Settings;
  const colorClass = NODE_TYPE_COLORS[nodeType] || "text-muted-foreground";

  return (
    <div className="w-[280px] border-l border-border bg-card flex flex-col">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
        <span className="text-xs font-medium text-foreground flex items-center gap-2">
          <Icon className={`w-3.5 h-3.5 ${colorClass}`} />
          Properties
        </span>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onToggle}>
          <PanelRightClose className="w-3.5 h-3.5" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-4">
          {/* Type info */}
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Type</p>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={`text-[10px] capitalize ${colorClass}`}>
                {nodeType}
              </Badge>
              <Badge variant="outline" className="text-[10px] capitalize">
                {subtype.replace("_", " ")}
              </Badge>
            </div>
          </div>

          {/* Label */}
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">
              Label
            </label>
            <Input
              className="h-8 text-xs bg-background"
              value={(node.data.label as string) || ""}
              onChange={(e) => onUpdate(node.id, { ...node.data, label: e.target.value })}
            />
          </div>

          {/* Agent-specific fields */}
          {nodeType === "agent" && (
            <>
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">
                  Model
                </label>
                <Select
                  value={(node.data.model as string) || "claude-sonnet"}
                  onValueChange={(val) => onUpdate(node.id, { ...node.data, model: val })}
                >
                  <SelectTrigger className="h-8 text-xs bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="claude-sonnet">Claude Sonnet</SelectItem>
                    <SelectItem value="claude-opus">Claude Opus</SelectItem>
                    <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                    <SelectItem value="perplexity">Perplexity Sonar</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">
                  System Prompt
                </label>
                <Textarea
                  className="text-xs bg-background min-h-[80px] resize-none"
                  placeholder="System prompt for this agent..."
                  value={(node.data.systemPrompt as string) || ""}
                  onChange={(e) => onUpdate(node.id, { ...node.data, systemPrompt: e.target.value })}
                />
              </div>
            </>
          )}

          {/* Trigger-specific fields */}
          {nodeType === "trigger" && subtype === "webhook" && (
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">
                Webhook URL
              </label>
              <Input
                className="h-8 text-xs bg-background font-mono"
                placeholder="/api/webhooks/..."
                value={(node.data.webhookUrl as string) || ""}
                onChange={(e) => onUpdate(node.id, { ...node.data, webhookUrl: e.target.value })}
              />
            </div>
          )}

          {nodeType === "trigger" && subtype === "schedule" && (
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">
                Cron Expression
              </label>
              <Input
                className="h-8 text-xs bg-background font-mono"
                placeholder="0 */6 * * *"
                value={(node.data.cron as string) || ""}
                onChange={(e) => onUpdate(node.id, { ...node.data, cron: e.target.value })}
              />
            </div>
          )}

          {/* Logic-specific fields */}
          {nodeType === "logic" && (subtype === "if_else" || subtype === "switch") && (
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">
                Condition Expression
              </label>
              <Textarea
                className="text-xs bg-background min-h-[60px] resize-none font-mono"
                placeholder="result.status === 'success'"
                value={(node.data.condition as string) || ""}
                onChange={(e) => onUpdate(node.id, { ...node.data, condition: e.target.value })}
              />
            </div>
          )}

          {nodeType === "logic" && subtype === "delay" && (
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">
                Duration
              </label>
              <Input
                className="h-8 text-xs bg-background"
                placeholder="5s, 1m, 1h"
                value={(node.data.duration as string) || ""}
                onChange={(e) => onUpdate(node.id, { ...node.data, duration: e.target.value })}
              />
            </div>
          )}

          {/* Delete button */}
          <div className="pt-2 border-t border-border">
            <Button
              variant="destructive"
              size="sm"
              className="w-full h-8 text-xs gap-1.5"
              onClick={() => onDelete(node.id)}
            >
              <Trash2 className="w-3 h-3" />
              Delete Node
            </Button>
          </div>
        </div>
      </ScrollArea>
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
  const [paletteCollapsed, setPaletteCollapsed] = useState(false);
  const [propsCollapsed, setPropsCollapsed] = useState(false);
  const [bottomCollapsed, setBottomCollapsed] = useState(false);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [canvasNodes, setCanvasNodes] = useState<Node[]>([]);
  const [canvasEdges, setCanvasEdges] = useState<Edge[]>([]);

  // ── Fetch workflow ──────────────────────────────────────────────────────────

  const { data: workflow } = useQuery<Workflow>({
    queryKey: ["/api/workflows", workflowId],
  });

  // Fetch agents assigned to workflow
  const { data: wfAgents } = useQuery<Agent[]>({
    queryKey: ["/api/workflows", workflowId, "agents"],
  });

  // Fetch canvas state
  const { data: canvasData } = useQuery<{ nodes: Node[]; edges: Edge[] }>({
    queryKey: ["canvas", workflowId],
    queryFn: async () => {
      try {
        const res = await fetch(`/api/workflows/${workflowId}/canvas`);
        if (!res.ok) return { nodes: [], edges: [] };
        const data = await res.json();
        return data?.canvasState
          ? (typeof data.canvasState === "string" ? JSON.parse(data.canvasState) : data.canvasState)
          : { nodes: [], edges: [] };
      } catch {
        return { nodes: [], edges: [] };
      }
    },
  });

  // Fetch latest run with polling
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
      if (data?.run?.status === "running" || data?.run?.status === "pending") {
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

  // Fetch versions
  const { data: versions = [] } = useQuery<CanvasVersion[]>({
    queryKey: ["canvas-versions", workflowId],
    queryFn: async () => {
      try {
        const res = await fetch(`/api/workflows/${workflowId}/versions`);
        if (!res.ok) return [];
        return res.json();
      } catch {
        return [];
      }
    },
  });

  // ── Mutations ───────────────────────────────────────────────────────────────

  const saveCanvasMutation = useMutation({
    mutationFn: async ({ nodes, edges }: { nodes: Node[]; edges: Edge[] }) => {
      await apiRequest("PUT", `/api/workflows/${workflowId}/canvas`, {
        canvasState: { nodes, edges },
      });
    },
    onError: () => {
      toast({ title: "Failed to save canvas", variant: "destructive" });
    },
  });

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

  const restoreVersionMutation = useMutation({
    mutationFn: async (versionId: number) => {
      await apiRequest("POST", `/api/workflows/${workflowId}/restore/${versionId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["canvas", workflowId] });
      queryClient.invalidateQueries({ queryKey: ["canvas-versions", workflowId] });
      toast({ title: "Version restored" });
    },
    onError: () => {
      toast({ title: "Failed to restore version", variant: "destructive" });
    },
  });

  // ── Derived state ──────────────────────────────────────────────────────────

  const latestRun = latestRunData?.run;
  const executions = latestRunData?.executions || [];
  const isRunActive = latestRun?.status === "running" || latestRun?.status === "pending";

  const initialNodes = useMemo(() => canvasData?.nodes || [], [canvasData]);
  const initialEdges = useMemo(() => canvasData?.edges || [], [canvasData]);

  // ── Callbacks ──────────────────────────────────────────────────────────────

  const handleCanvasSave = useCallback(
    (nodes: Node[], edges: Edge[]) => {
      setCanvasNodes(nodes);
      setCanvasEdges(edges);
      saveCanvasMutation.mutate({ nodes, edges });
    },
    [saveCanvasMutation]
  );

  const handleNodeUpdate = useCallback(
    (nodeId: string, data: Record<string, unknown>) => {
      // Update the selected node state
      setSelectedNode((prev) =>
        prev && prev.id === nodeId ? { ...prev, data } : prev
      );
      // The canvas will pick up the change via onSave
      const updatedNodes = canvasNodes.map((n) =>
        n.id === nodeId ? { ...n, data } : n
      );
      setCanvasNodes(updatedNodes);
      saveCanvasMutation.mutate({ nodes: updatedNodes, edges: canvasEdges });
    },
    [canvasNodes, canvasEdges, saveCanvasMutation]
  );

  const handleNodeDelete = useCallback(
    (nodeId: string) => {
      const updatedNodes = canvasNodes.filter((n) => n.id !== nodeId);
      const updatedEdges = canvasEdges.filter(
        (e) => e.source !== nodeId && e.target !== nodeId
      );
      setCanvasNodes(updatedNodes);
      setCanvasEdges(updatedEdges);
      setSelectedNode(null);
      saveCanvasMutation.mutate({ nodes: updatedNodes, edges: updatedEdges });
    },
    [canvasNodes, canvasEdges, saveCanvasMutation]
  );

  // Track node selection via canvas node changes
  const handleCanvasSaveWithSelection = useCallback(
    (nodes: Node[], edges: Edge[]) => {
      setCanvasNodes(nodes);
      setCanvasEdges(edges);
      // Update selected node
      const sel = nodes.find((n) => n.selected);
      setSelectedNode(sel || null);
      saveCanvasMutation.mutate({ nodes, edges });
    },
    [saveCanvasMutation]
  );

  // Loading state
  if (!workflow) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border bg-card flex-shrink-0">
        <Link href="/workflows">
          <button className="p-1.5 rounded-md hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" />
          </button>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="text-sm font-semibold truncate">{workflow.name}</h1>
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
            {isRunActive && (
              <Badge variant="outline" className="text-[10px] text-blue-400 border-blue-500/20 gap-1">
                <Loader2 className="w-2.5 h-2.5 animate-spin" />
                Running
              </Badge>
            )}
          </div>
        </div>

        {/* Kill button */}
        {isRunActive && latestRun && (
          <Button
            variant="destructive"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => killRunMutation.mutate(latestRun.id)}
            disabled={killRunMutation.isPending}
          >
            <Square className="w-3 h-3" />
            Kill
          </Button>
        )}

        {/* Bottom panel toggle */}
        <Button
          variant="ghost"
          size="sm"
          className={`h-7 w-7 p-0 ${!bottomCollapsed ? "bg-secondary" : ""}`}
          onClick={() => setBottomCollapsed(!bottomCollapsed)}
        >
          {bottomCollapsed ? (
            <PanelBottom className="w-3.5 h-3.5" />
          ) : (
            <PanelBottomClose className="w-3.5 h-3.5" />
          )}
        </Button>

        {/* Run Workflow Dialog */}
        <Dialog open={runOpen} onOpenChange={setRunOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 h-8 text-xs" disabled={isRunActive}>
              {isRunActive ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" />
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
                    <SelectItem value="claude-sonnet">Claude Sonnet (recommended)</SelectItem>
                    <SelectItem value="claude-opus">Claude Opus (most capable)</SelectItem>
                    <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                    <SelectItem value="perplexity">Perplexity Sonar (web search)</SelectItem>
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

      {/* ── Canvas Area ────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex min-h-0">
        {/* Left: Node Palette */}
        <NodePalette
          collapsed={paletteCollapsed}
          onToggle={() => setPaletteCollapsed(!paletteCollapsed)}
        />

        {/* Center: Canvas */}
        <div className="flex-1 min-w-0 relative">
          {canvasData !== undefined && (
            <WorkflowCanvas
              workflowId={workflowId}
              initialNodes={initialNodes}
              initialEdges={initialEdges}
              onSave={handleCanvasSaveWithSelection}
              isRunning={isRunActive}
              executionData={executions}
            />
          )}
        </div>

        {/* Right: Properties Panel */}
        <PropertiesPanel
          node={selectedNode}
          onUpdate={handleNodeUpdate}
          onDelete={handleNodeDelete}
          collapsed={propsCollapsed}
          onToggle={() => setPropsCollapsed(!propsCollapsed)}
        />
      </div>

      {/* ── Bottom Panel ──────────────────────────────────────────────────────── */}
      {!bottomCollapsed && (
        <div className="h-[220px] flex-shrink-0 border-t border-border bg-card">
          <Tabs defaultValue="execution" className="h-full flex flex-col">
            <div className="flex items-center justify-between px-3 border-b border-border flex-shrink-0">
              <TabsList className="h-8 bg-transparent p-0 gap-0">
                <TabsTrigger
                  value="execution"
                  className="text-[11px] px-3 h-8 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                >
                  Execution Timeline
                </TabsTrigger>
                <TabsTrigger
                  value="runs"
                  className="text-[11px] px-3 h-8 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                >
                  Run History ({allRuns.length})
                </TabsTrigger>
                <TabsTrigger
                  value="versions"
                  className="text-[11px] px-3 h-8 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                >
                  Versions ({versions.length})
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Execution Timeline Tab */}
            <TabsContent value="execution" className="flex-1 m-0 overflow-hidden">
              <ScrollArea className="h-full">
                <div className="p-3">
                  {!latestRun ? (
                    <div className="py-6 text-center">
                      <Zap className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
                      <p className="text-xs text-muted-foreground">No runs yet. Click &quot;Run Workflow&quot; to start.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* Status bar */}
                      <div className="flex items-center gap-2 text-xs">
                        <RunStatusBadge status={latestRun.status} />
                        {latestRun.totalTokensUsed > 0 && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 gap-1">
                            <Coins className="w-2.5 h-2.5" />
                            {formatTokens(latestRun.totalTokensUsed)}
                          </Badge>
                        )}
                        {latestRun.inputData && (
                          <span className="text-muted-foreground truncate flex-1">
                            {(() => {
                              try {
                                const parsed = JSON.parse(latestRun.inputData);
                                return parsed.prompt || parsed.userPrompt || "";
                              } catch {
                                return "";
                              }
                            })()}
                          </span>
                        )}
                      </div>

                      {/* Execution timeline */}
                      {executions.length > 0 && (
                        <ExecutionTimeline executions={executions} />
                      )}

                      {isRunActive && executions.length === 0 && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground py-4">
                          <Loader2 className="w-4 h-4 animate-spin text-primary" />
                          Starting orchestration...
                        </div>
                      )}

                      {latestRun.error && (
                        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
                          <span className="font-medium">Error:</span> {latestRun.error}
                        </div>
                      )}

                      {latestRun.finalOutput && latestRun.status === "completed" && (
                        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-xs font-medium text-foreground">Final Output</span>
                          </div>
                          <div className="text-xs text-foreground whitespace-pre-wrap leading-relaxed max-h-[120px] overflow-y-auto">
                            {latestRun.finalOutput}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            {/* Run History Tab */}
            <TabsContent value="runs" className="flex-1 m-0 overflow-hidden">
              <ScrollArea className="h-full">
                <div className="divide-y divide-border">
                  {allRuns.length === 0 ? (
                    <div className="p-6 text-center text-xs text-muted-foreground">
                      No runs yet.
                    </div>
                  ) : (
                    allRuns
                      .slice()
                      .sort(
                        (a, b) =>
                          new Date(b.createdAt).getTime() -
                          new Date(a.createdAt).getTime()
                      )
                      .map((run) => (
                        <div
                          key={run.id}
                          className="flex items-center gap-3 px-4 py-2 text-xs hover:bg-secondary/30 transition-colors"
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
                      ))
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            {/* Versions Tab */}
            <TabsContent value="versions" className="flex-1 m-0 overflow-hidden">
              <ScrollArea className="h-full">
                <div className="divide-y divide-border">
                  {versions.length === 0 ? (
                    <div className="p-6 text-center text-xs text-muted-foreground">
                      No saved versions yet. Canvas auto-saves as you edit.
                    </div>
                  ) : (
                    versions
                      .slice()
                      .sort(
                        (a, b) =>
                          new Date(b.createdAt).getTime() -
                          new Date(a.createdAt).getTime()
                      )
                      .map((v) => (
                        <div
                          key={v.id}
                          className="flex items-center gap-3 px-4 py-2 text-xs hover:bg-secondary/30 transition-colors"
                        >
                          <span className="text-foreground font-medium flex-1 truncate">
                            {v.label || `Version ${v.id}`}
                          </span>
                          <span className="text-muted-foreground">
                            {new Date(v.createdAt).toLocaleString("en-US", {
                              month: "short",
                              day: "numeric",
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 text-[10px] px-2"
                            onClick={() => restoreVersionMutation.mutate(v.id)}
                            disabled={restoreVersionMutation.isPending}
                          >
                            Restore
                          </Button>
                        </div>
                      ))
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
}
