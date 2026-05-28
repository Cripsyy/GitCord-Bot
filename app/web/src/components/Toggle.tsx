type ToggleProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  children?: React.ReactNode;
};

function Toggle({ checked, onChange, disabled, children }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={
        "inline-flex items-center gap-2 " +
        (disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer")
      }
    >
      <span
        className={
          "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200 ease-in-out " +
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-discord-blurple focus-visible:ring-offset-2 focus-visible:ring-offset-discord-850 " +
          (checked ? "bg-discord-blurple" : "bg-discord-800")
        }
      >
        <span
          className={
            "inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ease-in-out " +
            (checked ? "translate-x-[18px]" : "translate-x-0.5")
          }
        />
      </span>
      {children ? <span className="text-xs text-discord-300">{children}</span> : null}
    </button>
  );
}

export default Toggle;
