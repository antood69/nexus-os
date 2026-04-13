import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Plus,
  Pencil,
  Trash2,
  Store,
  ShoppingBag,
  Package,
  Eye,
  EyeOff,
  ArrowLeft,
  Star,
  Download,
  Calendar,
  ExternalLink,
  X,
} from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// ── Types ──────────────────────────────────────────────────────────────────
interface MarketplaceListing {
  id: number;
  title: string;
  shortDescription: string;
  description: string;
  category: string;
  price: number;
  priceType: "free" | "one_time" | "monthly";
  rating: number;
  reviewCount: number;
  installCount: number;
  sellerName: string;
  previewImages: string[];
  tags: string[];
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Purchase {
  id: number;
  listingId: number;
  listingTitle: string;
  price: number;
  priceType: string;
  purchasedAt: string;
}

interface ListingFormData {
  title: string;
  shortDescription: string;
  description: string;
  category: string;
  price: string;
  priceType: string;
  tags: string;
  previewImages: string;
  isPublished: boolean;
}

// ── Helpers ────────────────────────────────────────────────────────────────
const categoryColors: Record<string, string> = {
  workflow:    "bg-blue-500/15 text-blue-400 border-blue-500/20",
  agent:       "bg-violet-500/15 text-violet-400 border-violet-500/20",
  tool:        "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  prompt_pack: "bg-orange-500/15 text-orange-400 border-orange-500/20",
  theme:       "bg-pink-500/15 text-pink-400 border-pink-500/20",
};

const categoryLabels: Record<string, string> = {
  workflow: "Workflow",
  agent: "Agent",
  tool: "Tool",
  prompt_pack: "Prompt Pack",
  theme: "Theme",
};

function formatDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return dateStr ?? "";
  }
}

const emptyForm: ListingFormData = {
  title: "",
  shortDescription: "",
  description: "",
  category: "tool",
  price: "0",
  priceType: "free",
  tags: "",
  previewImages: "",
  isPublished: false,
};

function listingToForm(l: MarketplaceListing): ListingFormData {
  return {
    title: l.title,
    shortDescription: l.shortDescription,
    description: l.description,
    category: l.category,
    price: String(l.price ?? 0),
    priceType: l.priceType,
    tags: (l.tags ?? []).join(", "),
    previewImages: (l.previewImages ?? []).join(", "),
    isPublished: l.isPublished,
  };
}

// ── Listing Form Modal ─────────────────────────────────────────────────────
function ListingFormModal({
  open,
  onClose,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  editing: MarketplaceListing | null;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState<ListingFormData>(() =>
    editing ? listingToForm(editing) : emptyForm
  );

  // Reset form when editing target changes
  useState(() => {
    setForm(editing ? listingToForm(editing) : emptyForm);
  });

  const set = (key: keyof ListingFormData, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const buildPayload = () => ({
    title: form.title.trim(),
    shortDescription: form.shortDescription.trim(),
    description: form.description.trim(),
    category: form.category,
    price: parseFloat(form.price) || 0,
    priceType: form.priceType,
    tags: form.tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
    previewImages: form.previewImages
      .split(",")
      .map((u) => u.trim())
      .filter(Boolean),
    isPublished: form.isPublished,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/marketplace/listings", buildPayload());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marketplace/my/listings"] });
      toast({ title: "Listing created" });
      onClose();
    },
    onError: () => toast({ title: "Failed to create listing", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PUT", `/api/marketplace/listings/${editing!.id}`, buildPayload());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marketplace/my/listings"] });
      toast({ title: "Listing updated" });
      onClose();
    },
    onError: () => toast({ title: "Failed to update listing", variant: "destructive" }),
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editing) updateMutation.mutate();
    else createMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-card border-border max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Listing" : "Create New Listing"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Title */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Title *</label>
            <Input
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="e.g. SEO Audit Workflow"
              required
              className="bg-background border-border"
            />
          </div>

          {/* Short description */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Short Description *</label>
            <Input
              value={form.shortDescription}
              onChange={(e) => set("shortDescription", e.target.value)}
              placeholder="One-line summary for listing cards"
              required
              className="bg-background border-border"
            />
          </div>

          {/* Full description */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Full Description</label>
            <Textarea
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Detailed description. Supports **bold** and `code` formatting."
              className="bg-background border-border min-h-[120px]"
            />
          </div>

          {/* Category + Price type */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Category *</label>
              <Select value={form.category} onValueChange={(v) => set("category", v)}>
                <SelectTrigger className="bg-background border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="workflow">Workflow</SelectItem>
                  <SelectItem value="agent">Agent</SelectItem>
                  <SelectItem value="tool">Tool</SelectItem>
                  <SelectItem value="prompt_pack">Prompt Pack</SelectItem>
                  <SelectItem value="theme">Theme</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Price Type *</label>
              <Select
                value={form.priceType}
                onValueChange={(v) => {
                  set("priceType", v);
                  if (v === "free") set("price", "0");
                }}
              >
                <SelectTrigger className="bg-background border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="free">Free</SelectItem>
                  <SelectItem value="one_time">One-time</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Price (only if not free) */}
          {form.priceType !== "free" && (
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Price (USD) *
              </label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.price}
                onChange={(e) => set("price", e.target.value)}
                placeholder="9.99"
                className="bg-background border-border"
              />
            </div>
          )}

          {/* Tags */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Tags <span className="font-normal">(comma-separated)</span>
            </label>
            <Input
              value={form.tags}
              onChange={(e) => set("tags", e.target.value)}
              placeholder="automation, seo, research"
              className="bg-background border-border"
            />
          </div>

          {/* Preview image URLs */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Preview Image URLs <span className="font-normal">(comma-separated)</span>
            </label>
            <Input
              value={form.previewImages}
              onChange={(e) => set("previewImages", e.target.value)}
              placeholder="https://example.com/preview.png"
              className="bg-background border-border"
            />
          </div>

          {/* Published toggle */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => set("isPublished", !form.isPublished)}
              className={`relative w-10 h-5.5 rounded-full transition-colors ${
                form.isPublished ? "bg-primary" : "bg-muted"
              }`}
              style={{ height: "22px" }}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform shadow ${
                  form.isPublished ? "translate-x-4.5" : "translate-x-0"
                }`}
                style={{ transform: form.isPublished ? "translateX(18px)" : "translateX(0)" }}
              />
            </button>
            <span className="text-sm text-muted-foreground">
              {form.isPublished ? "Published — visible in marketplace" : "Draft — not visible publicly"}
            </span>
          </div>

          {/* Submit */}
          <div className="flex items-center gap-2 pt-1">
            <Button type="submit" disabled={!form.title.trim() || isPending} className="flex-1">
              {isPending ? "Saving…" : editing ? "Save Changes" : "Create Listing"}
            </Button>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function MyListingsPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"listings" | "purchases">("listings");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingListing, setEditingListing] = useState<MarketplaceListing | null>(null);

  const listingsQuery = useQuery<MarketplaceListing[]>({
    queryKey: ["/api/marketplace/my/listings"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/marketplace/my/listings");
      return res.json();
    },
  });

  const purchasesQuery = useQuery<Purchase[]>({
    queryKey: ["/api/marketplace/my/purchases"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/marketplace/my/purchases");
      return res.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/marketplace/listings/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marketplace/my/listings"] });
      toast({ title: "Listing deleted" });
    },
    onError: () => toast({ title: "Delete failed", variant: "destructive" }),
  });

  const openCreate = () => {
    setEditingListing(null);
    setModalOpen(true);
  };

  const openEdit = (listing: MarketplaceListing) => {
    setEditingListing(listing);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditingListing(null);
  };

  return (
    <div className="p-6 space-y-5 max-w-[1100px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/marketplace">
            <button className="p-1.5 rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </button>
          </Link>
          <div>
            <h1 className="text-xl font-semibold">My Marketplace</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Manage your listings and purchases</p>
          </div>
        </div>
        <Button className="gap-2" onClick={openCreate} data-testid="button-create-listing">
          <Plus className="w-4 h-4" />
          New Listing
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border">
        {(["listings", "purchases"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === tab
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab === "listings" ? <Store className="w-3.5 h-3.5" /> : <ShoppingBag className="w-3.5 h-3.5" />}
            {tab === "listings" ? "My Listings" : "My Purchases"}
            {tab === "listings" && listingsQuery.data?.length !== undefined && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                {listingsQuery.data.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── MY LISTINGS TAB ── */}
      {activeTab === "listings" && (
        <>
          {listingsQuery.isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 rounded-xl bg-card border border-border animate-pulse" />
              ))}
            </div>
          ) : !listingsQuery.data?.length ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Package className="w-12 h-12 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground mb-1">No listings yet</p>
              <p className="text-xs text-muted-foreground mb-4">Create your first listing to sell in the marketplace</p>
              <Button size="sm" className="gap-2" onClick={openCreate}>
                <Plus className="w-4 h-4" />
                Create Listing
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {listingsQuery.data.map((listing) => {
                const catColor = categoryColors[listing.category] ?? "bg-muted text-muted-foreground border-border";
                const catLabel = categoryLabels[listing.category] ?? listing.category;
                const priceLabel =
                  listing.priceType === "free" || listing.price === 0
                    ? "Free"
                    : listing.priceType === "monthly"
                    ? `$${listing.price}/mo`
                    : `$${listing.price}`;

                return (
                  <div
                    key={listing.id}
                    data-testid={`card-my-listing-${listing.id}`}
                    className="bg-card border border-border rounded-xl p-4 flex items-center gap-4"
                  >
                    {/* Status dot */}
                    <div
                      className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        listing.isPublished ? "bg-emerald-400" : "bg-muted-foreground"
                      }`}
                    />

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <span className="text-sm font-medium truncate">{listing.title}</span>
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${catColor}`}>
                          {catLabel}
                        </span>
                        {listing.isPublished ? (
                          <span className="flex items-center gap-0.5 text-[10px] text-emerald-400">
                            <Eye className="w-2.5 h-2.5" /> Published
                          </span>
                        ) : (
                          <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                            <EyeOff className="w-2.5 h-2.5" /> Draft
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{listing.shortDescription}</p>
                    </div>

                    {/* Stats */}
                    <div className="hidden md:flex items-center gap-4 flex-shrink-0 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Download className="w-3 h-3" />
                        {(listing.installCount ?? 0).toLocaleString()}
                      </div>
                      <div className="flex items-center gap-1">
                        <Star className="w-3 h-3" />
                        {listing.rating?.toFixed(1) ?? "—"}
                      </div>
                      <span className="font-medium text-foreground">{priceLabel}</span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <Link href={`/marketplace/${listing.id}`}>
                        <button className="p-1.5 rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                      </Link>
                      <button
                        data-testid={`button-edit-listing-${listing.id}`}
                        onClick={() => openEdit(listing)}
                        className="p-1.5 rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        data-testid={`button-delete-listing-${listing.id}`}
                        onClick={() => {
                          if (confirm("Delete this listing?")) deleteMutation.mutate(listing.id);
                        }}
                        className="p-1.5 rounded-md text-muted-foreground hover:bg-destructive/15 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── MY PURCHASES TAB ── */}
      {activeTab === "purchases" && (
        <>
          {purchasesQuery.isLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="h-16 rounded-xl bg-card border border-border animate-pulse" />
              ))}
            </div>
          ) : !purchasesQuery.data?.length ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <ShoppingBag className="w-12 h-12 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground mb-1">No purchases yet</p>
              <p className="text-xs text-muted-foreground mb-4">Browse the marketplace to find tools and templates</p>
              <Link href="/marketplace">
                <Button size="sm" variant="outline">Browse Marketplace</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {purchasesQuery.data.map((purchase) => (
                <div
                  key={purchase.id}
                  data-testid={`card-purchase-${purchase.id}`}
                  className="bg-card border border-border rounded-xl p-4 flex items-center justify-between gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{purchase.listingTitle ?? "Unknown listing"}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDate(purchase.purchasedAt)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-xs font-medium">
                      {purchase.price === 0 || purchase.priceType === "free"
                        ? "Free"
                        : purchase.priceType === "monthly"
                        ? `$${purchase.price}/mo`
                        : `$${purchase.price}`}
                    </span>
                    <Link href={`/marketplace/${purchase.listingId}`}>
                      <button className="flex items-center gap-1 text-xs text-primary hover:underline">
                        <ExternalLink className="w-3 h-3" />
                        View
                      </button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Create/Edit modal */}
      {modalOpen && (
        <ListingFormModal
          open={modalOpen}
          onClose={handleCloseModal}
          editing={editingListing}
        />
      )}
    </div>
  );
}
