import { useState } from "react";
import { SearchIcon, ListIcon, GridIcon } from "./Icons";

type ViewMode = "list" | "grid";

export type SortDef<T> = {
  value: string;
  label: string;
  compare: (a: T, b: T) => number;
};

type ConfigViewProps<T> = {
  items: T[];
  sortDefs: SortDef<T>[];
  getSearchText: (item: T) => string;
  renderItem: (item: T) => React.ReactNode;
  searchPlaceholder?: string;
  emptyMessage?: string;
  toolbarExtra?: React.ReactNode;
  hideToolbar?: boolean;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  sortField?: string;
  onSortChange?: (field: string) => void;
  viewMode?: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;
};

export default function ConfigView<T>({
  items,
  sortDefs,
  getSearchText,
  renderItem,
  searchPlaceholder = "Search...",
  emptyMessage = "No items found.",
  toolbarExtra,
  hideToolbar = false,
  searchQuery: searchQueryProp,
  onSearchChange,
  sortField: sortFieldProp,
  onSortChange,
  viewMode: viewModeProp,
  onViewModeChange,
}: ConfigViewProps<T>) {
  const [internalSearch, setInternalSearch] = useState("");
  const [internalSort, setInternalSort] = useState(sortDefs[0]?.value ?? "");
  const [internalViewMode, setInternalViewMode] = useState<ViewMode>("list");

  const searchQuery = searchQueryProp ?? internalSearch;
  const sortField = sortFieldProp ?? internalSort;
  const viewMode = viewModeProp ?? internalViewMode;

  const setSearchQuery = onSearchChange ?? setInternalSearch;
  const setSortField = onSortChange ?? setInternalSort;
  const setViewMode = onViewModeChange ?? setInternalViewMode;

  const activeSort = sortDefs.find((s) => s.value === sortField) ?? sortDefs[0];

  const filtered = items.filter((item) =>
    getSearchText(item).toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sorted = [...filtered].sort(
    activeSort ? activeSort.compare : () => 0
  );

  return (
    <div>
      {!hideToolbar ? (
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-0 flex-1">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-discord-500">
              <SearchIcon />
            </span>
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full rounded-lg border border-white/10 bg-discord-900 py-2 pl-9 pr-3 text-sm text-discord-200 outline-none placeholder:text-discord-500 focus:border-discord-blurple"
            />
          </div>

          <div className="relative">
            <select
              value={sortField}
              onChange={(e) => setSortField(e.target.value)}
              className="appearance-none rounded-lg border border-white/10 bg-discord-900 px-8 py-2 text-sm text-discord-200 outline-none focus:border-discord-blurple"
            >
              {sortDefs.map((def) => (
                <option key={def.value} value={def.value}>
                  Sort: {def.label}
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-discord-500">
              ▾
            </span>
          </div>

          <div className="flex items-center overflow-hidden rounded-lg border border-white/10">
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={`px-2.5 py-2 ${
                viewMode === "list"
                  ? "bg-discord-blurple text-white"
                  : "bg-discord-800 text-discord-400 hover:text-discord-200"
              }`}
              title="List view"
            >
              <ListIcon />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={`px-2.5 py-2 ${
                viewMode === "grid"
                  ? "bg-discord-blurple text-white"
                  : "bg-discord-800 text-discord-400 hover:text-discord-200"
              }`}
              title="Grid view"
            >
              <GridIcon />
            </button>
          </div>

          {toolbarExtra ? (
            <div>{toolbarExtra}</div>
          ) : null}
        </div>
      ) : null}

      {sorted.length === 0 ? (
        <div className="rounded-2xl border border-white/5 bg-discord-850 px-5 py-8 text-center">
          <p className="text-sm text-discord-500">{emptyMessage}</p>
        </div>
      ) : viewMode === "list" ? (
        <div className="space-y-3">
          {sorted.map((item, i) => (
            <div key={i}>{renderItem(item)}</div>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {sorted.map((item, i) => (
            <div key={i}>{renderItem(item)}</div>
          ))}
        </div>
      )}
    </div>
  );
}
