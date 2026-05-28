type NumberStepperProps = {
  value: number;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
  disabled?: boolean;
  className?: string;
};

function NumberStepper({ value, onChange, step = 1, min = 0, disabled, className }: NumberStepperProps) {
  function decrement() {
    onChange(Math.max(min, value - step));
  }

  function increment() {
    onChange(value + step);
  }

  return (
    <span
      className={
        "inline-flex items-center overflow-hidden rounded-lg border focus-within:border-discord-blurple " +
        (disabled ? "border-white/5" : "border-white/10") +
        " " +
        (className ?? "")
      }
    >
      <button
        type="button"
        onClick={decrement}
        disabled={disabled || value <= min}
        className={
          "border-r px-2.5 py-2 text-sm transition-colors duration-150 ease-in-out " +
          (disabled
            ? "cursor-not-allowed border-white/5 text-discord-500 opacity-40"
            : "border-white/10 text-discord-200 hover:bg-discord-800"
          )
        }
      >
        −
      </button>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        min={min}
        disabled={disabled}
        className={
          "w-16 bg-discord-900 px-2 py-2 text-center text-sm text-discord-200 outline-none " +
          (disabled ? "cursor-not-allowed opacity-40" : "")
        }
      />
      <button
        type="button"
        onClick={increment}
        disabled={disabled}
        className={
          "border-l px-2.5 py-2 text-sm transition-colors duration-150 ease-in-out " +
          (disabled
            ? "cursor-not-allowed border-white/5 text-discord-500 opacity-40"
            : "border-white/10 text-discord-200 hover:bg-discord-800"
          )
        }
      >
        +
      </button>
    </span>
  );
}

export default NumberStepper;
