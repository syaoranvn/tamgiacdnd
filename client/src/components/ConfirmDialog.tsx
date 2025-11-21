import { useEffect } from "react";

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  type?: "confirm" | "alert";
}

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText = "Xác nhận",
  cancelText = "Hủy",
  onConfirm,
  onCancel,
  type = "confirm",
}: ConfirmDialogProps) {
  // Handle ESC key
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCancel();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl border border-amber-200 bg-white shadow-xl">
        <div className="p-6">
          <h3 className="mb-4 font-display text-xl text-ink">{title}</h3>
          <p className="mb-6 text-slate-700 whitespace-pre-line">{message}</p>
          <div className="flex gap-3 justify-end">
            {type === "confirm" && (
              <button
                onClick={onCancel}
                className="rounded-xl border border-slate-300 bg-white px-6 py-2.5 text-slate-700 transition-all hover:bg-slate-50"
              >
                {cancelText}
              </button>
            )}
            <button
              onClick={onConfirm}
              className={`rounded-xl px-6 py-2.5 text-white transition-all ${
                type === "alert"
                  ? "bg-amber-600 hover:bg-amber-700"
                  : "bg-red-600 hover:bg-red-700"
              }`}
            >
              {type === "alert" ? "Đóng" : confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

