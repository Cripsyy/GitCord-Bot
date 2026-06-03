import { useEffect, useCallback } from "react";

type ModalProps = {
  isOpen: boolean;
  onClose: () => void;
  maxWidth?: string;
  children: React.ReactNode;
};

function Modal({ isOpen, onClose, maxWidth = "max-w-md", children }: ModalProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (!isOpen) return;
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`max-h-[90vh] w-full overflow-y-auto rounded-2xl border border-white/5 bg-discord-850 p-6 shadow-soft ${maxWidth}`}
      >
        {children}
      </div>
    </div>
  );
}

export default Modal;
