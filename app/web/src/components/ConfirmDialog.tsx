import { createContext, useCallback, useContext, useRef, useState } from "react";
import Modal from "./Modal";

type ConfirmOptions = {
  danger?: boolean;
};

type ConfirmState = {
  isOpen: boolean;
  message: string;
  danger: boolean;
};

type ConfirmContextValue = (message: string, options?: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export function useConfirm(): ConfirmContextValue {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within ConfirmProvider");
  return ctx;
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ConfirmState>({
    isOpen: false,
    message: "",
    danger: false,
  });
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback(
    (message: string, options?: ConfirmOptions): Promise<boolean> => {
      return new Promise((resolve) => {
        resolveRef.current = resolve;
        setState({ isOpen: true, message, danger: options?.danger ?? false });
      });
    },
    []
  );

  function handleConfirm() {
    resolveRef.current?.(true);
    resolveRef.current = null;
    setState({ isOpen: false, message: "", danger: false });
  }

  function handleCancel() {
    resolveRef.current?.(false);
    resolveRef.current = null;
    setState({ isOpen: false, message: "", danger: false });
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal isOpen={state.isOpen} onClose={handleCancel} maxWidth="max-w-sm">
        <p className="text-sm text-discord-200">{state.message}</p>
        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={handleCancel}
            className="rounded-lg border border-white/10 px-4 py-2 text-xs text-discord-400 hover:text-discord-200"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className={`rounded-lg px-4 py-2 text-xs font-semibold text-white ${
              state.danger
                ? "bg-red-600 hover:bg-red-500"
                : "bg-discord-blurple"
            }`}
          >
            Confirm
          </button>
        </div>
      </Modal>
    </ConfirmContext.Provider>
  );
}
