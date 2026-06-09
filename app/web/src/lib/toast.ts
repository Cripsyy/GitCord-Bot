import { toast } from "sonner";

export function showError(message: string) {
  toast.error(message, {
    className: "!bg-red-950 !border-red-800",
  });
}

export function showSuccess(message: string) {
  toast.success(message, {
    className: "!bg-green-950 !border-green-700",
  });
}

export function showWarning(message: string) {
  toast.warning(message, {
    className: "!bg-yellow-950 !border-yellow-700",
  });
}

export { toast };
