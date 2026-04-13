import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Search, Star, Download, Package, Store } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// ── Types (matches shared/schema.ts MarketplaceListing) ───────────────────
interface MarketplaceListing {
  id: string;
  sellerId: number;
  title: string;
  description: string;
  shortDescription: string | null;
  category: "workflow" | "agent" | "tool" | "prompt_pack" | "theme";
  listingType: string;
  priceUsd: number;
  priceType: "one_time" | "monthly" | "free";
  contentRef: string | null;
  version: string;
  isPublished: number;
  isVerified: number;
  installCount: number;
  ratingAvg: number;
  ratingCount: number;
  previewImages: string | null;
  tags: string | null;
  createdAt: string;
  updatedAt: string;
}

interface CategoryCount {
  category: string;
  count: number;
}

// ── Category styling ───────────────────────────────────────────────────────
const categoryColors: Record<string, { badge: string; placeholder: string }> = {
  workflow:    { badge: "bg-blue-500/15 text-blue-400 border-blue-500/20",   placeholder: "from-blue-900/40 to-blue-800/20" },
  agent:       { badge: "bg-violet-500/15 text-violet-400 border-violet-500/20", placeholder: "from-violet-900/40 to-violet-800/20" },
  tool:        { badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20", placeholder: "from-emerald-900/40 to-emerald-800/20" },
  prompt_pack: { badge: "bg-orange-500/15 text-orange-400 border-orange-500/20",  placeholder: "from-orange-900/40 to-orange-800/20" },
  theme:       { badge: "bg-pink-500/15 text-pink-400 border-pink-500/20",   placeholder: "from-pink-900/40 to-pink-800/20" },
};

const categoryLabels: Record<string, string> = {
  workflow: "Workflow",
  agent: "Agent",
  tool: "Tool",
  prompt_pack: "Prompt Pack",
  theme: "Theme",
};

function StarRating({ rating, count }: { rating: number; count: number }) {
  const stars = Math.round(rating * 2) / 2;
  return (
    <div className="flex items-center gap-1">
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((s) => (
          <Star
            key={s}
            className={`w-3 h-3 ${s <= stars ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`}
          />
        ))}
      </div>
      <span className="text-[11px] text-muted-foreground">({count})</span>
    </div>
  );
}

function CategoryPlaceholder({ category }: { category: string }) {
  const colors = categoryColors[category] ?? { placeholder: "from-muted/40 to-muted/20" };
  return (
    <div className={`w-full h-full bg-gradient-to-br ${colors.placeholder} flex items-center justify-center`}>
      <Package className="w-10 h-10 text-muted-foreground/40" />
    </div>
  );
}

function parseJsonArray(val: string | null): string[] {
  if (!val) return [];
  try { return JSON.parse(val); } catch { return []; }
}

function ListingCard({ listing }: { listing: MarketplaceListing }) {
  const colors = categoryColors[listing.category] ?? { badge: "bg-muted text-muted-foreground border-border", placeholder: "from-muted/40 to-muted/20" };
  const label = categoryLabels[listing.category] ?? listing.category;
  const isFree = listing.priceType === "free" || listing.priceUsd === 0;
  const priceLabel = isFree
    ? "FREE"
    : listing.priceType === "monthly"
    ? `$${listing.priceUsd.toFixed(2)}/mo`
    : `$${listing.priceUsd.toFixed(2)}`;
  const priceStyle = isFree
    ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20"
    : "bg-blue-500/15 text-blue-400 border-blue-500/20";
  const images = parseJsonArray(listing.previewImages);

  return (
    <Link href={`/marketplace/${listing.id}`}>
      <div data-testid={`card-listing-${listing.id}`} className="bg-card border border-border rounded-xl overflow-hidden hover:border-primary/30 transition-colors cursor-pointer flex flex-col h-full">
        <div className="w-full h-40 overflow-hidden flex-shrink-0">
          {images[0] ? (
            <img
              src={images[0]}
              alt={listing.title}
              className="w-full h-full object-cover"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            />
          ) : (
            <CategoryPlaceholder category={listing.category} />
          )}
        </div>

        <div className="p-4 flex-1 flex flex-col gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${colors.badge}`}>
              {label}
            </span>
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${priceStyle}`}>
              {priceLabel}
            </span>
          </div>

          <h3 className="text-sm font-semibold leading-snug line-clamp-1">{listing.title}</h3>
          <p className="text-xs text-muted-foreground line-clamp-2 flex-1">{listing.shortDescription ?? ""}</p>

          <div className="mt-auto pt-2 border-t border-border/50 flex items-center justify-between gap-2">
            <StarRating rating={listing.ratingAvg ?? 0} count={listing.ratingCount ?? 0} />
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Download className="w-3 h-3" />
              {(listing.installCount ?? 0).toLocaleString()}
            </div>
          </div>

          <Button variant="outline" size="sm" className="w-full text-xs mt-1" data-testid={`button-view-${listing.id}`}>
            View
          </Button>
        </div>
      </div>
    </Link>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden animate-pulse">
      <div className="w-full h-40 bg-muted" />
      <div className="p-4 space-y-2.5">
        <div className="h-4 bg-muted rounded w-1/3" />
        <div className="h-4 bg-muted rounded w-2/3" />
        <div className="h-3 bg-muted rounded w-full" />
        <div className="h-3 bg-muted rounded w-4/5" />
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function MarketplacePage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState("popular");
  const [priceFilter, setPriceFilter] = useState("all");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const handleSearchChange = (value: string) => {
    setSearch(value);
    clearTimeout((window as any)._mktSearchTimer);
    (window as any)._mktSearchTimer = setTimeout(() => setDebouncedSearch(value), 350);
  };

  const listingsQuery = useQuery<MarketplaceListing[]>({
    queryKey: ["/api/marketplace/listings", category, sort, priceFilter, debouncedSearch],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (category !== "all") params.set("category", category);
      if (sort) params.set("sortBy", sort);
      if (priceFilter !== "all") params.set("priceType", priceFilter === "paid" ? "one_time" : priceFilter);
      if (debouncedSearch) params.set("search", debouncedSearch);
      const res = await apiRequest("GET", `/api/marketplace/listings?${params}`);
      const json = await res.json();
      return json.listings ?? [];
    },
  });

  const categoriesQuery = useQuery<CategoryCount[]>({
    queryKey: ["/api/marketplace/categories"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/marketplace/categories");
      const json = await res.json();
      return json.categories ?? [];
    },
  });

  const getCategoryCount = (cat: string) =>
    categoriesQuery.data?.find((c) => c.category === cat)?.count ?? 0;

  const totalCount = categoriesQuery.data?.reduce((sum, c) => sum + c.count, 0) ?? 0;

  const tabs = [
    { key: "all", label: "All", count: totalCount },
    { key: "workflow", label: "Workflows", count: getCategoryCount("workflow") },
    { key: "agent", label: "Agents", count: getCategoryCount("agent") },
    { key: "tool", label: "Tools", count: getCategoryCount("tool") },
    { key: "prompt_pack", label: "Prompt Packs", count: getCategoryCount("prompt_pack") },
    { key: "theme", label: "Themes", count: getCategoryCount("theme") },
  ];

  return (
    <div className="p-6 space-y-6 max-w-[1400px]">
      {/* Hero */}
      <div className="rounded-xl border border-border bg-gradient-to-br from-primary/10 via-card to-card p-8 text-center space-y-4">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/15 mb-1">
          <Store className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Marketplace</h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            Templates, agents, tools, and more — built by the community
          </p>
        </div>
        <div className="max-w-lg mx-auto relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            data-testid="input-marketplace-search"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search listings..."
            className="pl-9 bg-background border-border"
          />
        </div>
      </div>

      {/* Filters row */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1 flex-wrap">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              data-testid={`tab-category-${tab.key}`}
              onClick={() => setCategory(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                category === tab.key
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              {tab.label}
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                category === tab.key ? "bg-primary/20" : "bg-muted"
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger data-testid="select-sort" className="bg-background border-border h-8 text-xs w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value="popular">Popular</SelectItem>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="price_low">Price Low-High</SelectItem>
              <SelectItem value="price_high">Price High-Low</SelectItem>
            </SelectContent>
          </Select>

          <Select value={priceFilter} onValueChange={setPriceFilter}>
            <SelectTrigger data-testid="select-price" className="bg-background border-border h-8 text-xs w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value="all">All Prices</SelectItem>
              <SelectItem value="free">Free</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
            </SelectContent>
          </Select>

          <Link href="/marketplace/my">
            <Button variant="outline" size="sm" className="text-xs h-8 border-border" data-testid="button-my-listings">
              My Listings
            </Button>
          </Link>
        </div>
      </div>

      {/* Listings grid */}
      {listingsQuery.isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => <SkeletonCard key={i} />)}
        </div>
      ) : listingsQuery.isError ? (
        <div data-testid="listings-error" className="text-center py-20 text-sm text-muted-foreground">
          Failed to load listings. Please try again.
        </div>
      ) : !listingsQuery.data?.length ? (
        <div data-testid="listings-empty" className="flex flex-col items-center justify-center py-20 text-center">
          <Package className="w-12 h-12 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground mb-1">No listings yet. Check back soon!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {listingsQuery.data.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>
      )}
    </div>
  );
}
