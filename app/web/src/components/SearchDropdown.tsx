import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";

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
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

  const filtered = items.filter((item) =>
    item.label.toLowerCase().includes(search.toLowerCase())
  );
  const selectedLabel = items.find((i) => i.value === selected)?.label;

  function updatePosition() {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownStyle({
        position: "fixed",
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      });
    }
  }

  useEffect(() => {
    if (!open) return;
    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  function handleSelect(value: string) {
    onSelect(value);
    setOpen(false);
    setSearch("");
  }

  return (
    <label className="text-xs text-discord-500">
      {label}
      <div className={label ? "mt-1" : ""}>
        <button
          ref={buttonRef}
          type="button"
          onClick={() => {
            if (!open) updatePosition();
            setOpen((prev) => !prev);
          }}
          className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-discord-900 px-3 py-2 text-sm text-discord-200"
        >
          <span className="truncate">{selectedLabel ?? placeholder ?? "Select..."}</span>
          <span className="ml-2 shrink-0 text-discord-500">▾</span>
        </button>
        {open &&
          createPortal(
            <div
              ref={dropdownRef}
              style={dropdownStyle}
              className="z-[9999] mt-1 rounded-lg border border-white/10 bg-discord-900 p-2 shadow-2xl"
            >
              <button
                type="button"
                onClick={() => handleSelect("")}
                className="w-full rounded-md px-2 py-1.5 text-left text-xs text-discord-500 hover:bg-discord-850"
              >
                Clear selection
              </button>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                autoFocus
                className="mt-1 w-full rounded-md border border-white/10 bg-discord-850 px-2 py-1.5 text-xs text-discord-200 outline-none focus:border-discord-blurple"
              />
              <div className="mt-1 max-h-40 overflow-y-auto">
                {filtered.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => handleSelect(item.value)}
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
            </div>,
            document.body
          )}
      </div>
    </label>
  );
}
