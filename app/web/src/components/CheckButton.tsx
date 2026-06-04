type CheckButtonProps = {
  checked: boolean;
  onChange: () => void;
  children?: React.ReactNode;
  size?: "sm" | "md";
  className?: string;
};

function CheckButton({ checked, onChange, children, size = "md", className }: CheckButtonProps) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={
        "rounded-lg border font-medium text-white transition-colors duration-150 ease-in-out " +
        (size === "sm" ? "px-2 py-1 text-xs" : "px-3 py-1.5 text-xs") +
        " " +
        (checked
          ? "border-transparent bg-discord-blurple"
          : " border-white/10 text-discord-400") +
        " " +
        (className ?? "")
      }
    >
      {children}
    </button>
  );
}

export default CheckButton;
