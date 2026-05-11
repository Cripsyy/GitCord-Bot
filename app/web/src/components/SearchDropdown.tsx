import { useState } from "react";

type DropdownItem = { value: string; label: string };

type SearchDropdownProps = {
  label: string;
  items: DropdownItem[];
  selected: string;
  onSelect: (value: string) => void;
  placeholder?: string;
};

export default function SearchDropdown({ label, items, selected, onSelect, placeholder }: SearchDropdownProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const filtered = items.filter((item) =>
    item.label.toLowerCase().includes(search.toLowerCase())
  );
  const selectedLabel = items.find((i) => i.value === selected)?.label;

  return (
    <label className="text-xs text-discord-500">
      {label}
      <div className="relative mt-1">
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-discord-900 px-3 py-2 text-sm text-discord-200"
        >
          <span className="truncate">{selectedLabel ?? placeholder ?? "Select..."}</span>
          <span className="ml-2 shrink-0 text-discord-500">▾</span>
        </button>
        {open ? (
          <div className="absolute z-20 mt-1 w-full rounded-lg border border-white/10 bg-discord-900 p-2">
            <button
              type="button"
              onClick={() => { onSelect(""); setOpen(false); setSearch(""); }}
              className="w-full rounded-md px-2 py-1.5 text-left text-xs text-discord-500 hover:bg-discord-850"
            >
              Clear selection
            </button>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="mt-1 w-full rounded-md border border-white/10 bg-discord-850 px-2 py-1.5 text-xs text-discord-200 outline-none focus:border-discord-blurple"
            />
            <div className="mt-1 max-h-40 overflow-y-auto">
              {filtered.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => { onSelect(item.value); setOpen(false); setSearch(""); }}
                  className={`w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-discord-850 ${
                    item.value === selected ? "text-discord-blurple" : "text-discord-200"
                  }`}
                >
                  {item.label}
                </button>
              ))}
              {filtered.length === 0 ? (
                <p className="px-2 py-1.5 text-xs text-discord-500">No matches</p>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </label>
  );
}
