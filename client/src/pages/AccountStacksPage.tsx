import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layers, Plus, Trash2, ArrowRight, ToggleLeft, ToggleRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";

type BrokerConnection = {
  id: string;
  broker: string;
  label: string | null;
  isPaper: number;
  isActive: number;
  accountId: string | null;
};

type StackFollower = {
  id: string;
  stackId: string;
  connectionId: string;
  sizeMultiplier: number;
  isActive: number;
};

type AccountStack = {
  id: string;
  name: string;
  leaderConnectionId: string;
  status: string;
  copyMode: string;
  sizeMultiplier: number;
  followers: StackFollower[];
};

export default function AccountStacksPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [leaderId, setLeaderId] = useState("");
  const [selectedFollowers, setSelectedFollowers] = useState<string[]>([]);

  const { data: stacks = [] } = useQuery<AccountStack[]>({ queryKey: ["/api/account-stacks"] });
  const { data: connections = [] } = useQuery<BrokerConnection[]>({ queryKey: ["/api/broker-connections"] });

  const createStack = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/account-stacks", {
        name,
        leaderConnectionId: leaderId,
        followerConnectionIds: selectedFollowers,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/account-stacks"] });
      setShowCreate(false);
      setName("");
      setLeaderId("");
      setSelectedFollowers([]);
    },
  });

  const deleteStack = useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/account-stacks/${id}`); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/account-stacks"] }),
  });

  const addFollower = useMutation({
    mutationFn: async ({ stackId, connectionId }: { stackId: string; connectionId: string }) => {
      await apiRequest("POST", `/api/account-stacks/${stackId}/followers`, { connectionId });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/account-stacks"] }),
  });

  const removeFollower = useMutation({
    mutationFn: async ({ stackId, fid }: { stackId: string; fid: string }) => {
      await apiRequest("DELETE", `/api/account-stacks/${stackId}/followers/${fid}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/account-stacks"] }),
  });

  const getLabel = (connId: string) => {
    const c = connections.find(x => x.id === connId);
    return c ? (c.label || `${c.broker} ${c.isPaper ? 'Paper' : 'Live'}`) : connId;
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Layers className="w-6 h-6 text-primary" /> Account Stacks
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Multi-account trade copier. Group accounts and designate a leader to copy trades to followers.
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-1">
          <Plus className="w-4 h-4" /> New Stack
        </Button>
      </div>

      {showCreate && (
        <div className="bg-card border border-border rounded-lg p-5 space-y-4">
          <h2 className="font-semibold text-foreground">Create New Stack</h2>
          <div>
            <label className="text-sm text-muted-foreground">Stack Name</label>
            <input
              className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="My Trading Stack"
            />
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Leader Account</label>
            <select
              className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground"
              value={leaderId}
              onChange={e => setLeaderId(e.target.value)}
            >
              <option value="">Select leader...</option>
              {connections.map(c => (
                <option key={c.id} value={c.id}>{c.label || `${c.broker} ${c.isPaper ? 'Paper' : 'Live'}`}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Follower Accounts</label>
            <div className="mt-1 space-y-1">
              {connections.filter(c => c.id !== leaderId).map(c => (
                <label key={c.id} className="flex items-center gap-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={selectedFollowers.includes(c.id)}
                    onChange={e => {
                      if (e.target.checked) setSelectedFollowers([...selectedFollowers, c.id]);
                      else setSelectedFollowers(selectedFollowers.filter(f => f !== c.id));
                    }}
                  />
                  {c.label || `${c.broker} ${c.isPaper ? 'Paper' : 'Live'}`}
                </label>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => createStack.mutate()} disabled={!name || !leaderId}>Create Stack</Button>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {stacks.length === 0 && !showCreate && (
        <div className="text-center py-16 text-muted-foreground">
          <Layers className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p>No stacks yet. Create one to start copying trades.</p>
        </div>
      )}

      <div className="space-y-4">
        {stacks.map(stack => (
          <div key={stack.id} className="bg-card border border-border rounded-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-foreground">{stack.name}</h3>
                <span className="text-xs text-muted-foreground">Mode: {stack.copyMode} &middot; Multiplier: {stack.sizeMultiplier}x</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${stack.status === 'active' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-500/10 text-zinc-400'}`}>
                  {stack.status}
                </span>
                <Button variant="ghost" size="sm" onClick={() => deleteStack.mutate(stack.id)}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 min-w-[160px]">
                <span className="text-[10px] uppercase tracking-wider text-primary font-medium">Leader</span>
                <p className="text-sm font-medium text-foreground mt-1">{getLabel(stack.leaderConnectionId)}</p>
              </div>

              {stack.followers.length > 0 && (
                <div className="flex items-center mt-4">
                  <ArrowRight className="w-5 h-5 text-muted-foreground" />
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {stack.followers.map(f => (
                  <div key={f.id} className="bg-secondary/50 border border-border rounded-lg p-3 min-w-[140px] relative group">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Follower</span>
                    <p className="text-sm font-medium text-foreground mt-1">{getLabel(f.connectionId)}</p>
                    <span className="text-xs text-muted-foreground">{f.sizeMultiplier}x size</span>
                    <button
                      className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => removeFollower.mutate({ stackId: stack.id, fid: f.id })}
                    >
                      <Trash2 className="w-3 h-3 text-destructive" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
