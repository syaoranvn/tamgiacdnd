import { useState, useRef } from "react";
import type { Character } from "../types";
import { apiUrl } from "../config/api";

interface ImportCharacterDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: (character: Character) => void;
}

export default function ImportCharacterDialog({
  isOpen,
  onClose,
  onImportSuccess,
}: ImportCharacterDialogProps) {
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileSelect = async (file: File) => {
    if (!file) return;

    // Check file type
    const isJson = file.type === "application/json" || file.name.endsWith(".json");
    const isPdf = file.type === "application/pdf" || file.name.endsWith(".pdf");

    if (!isJson && !isPdf) {
      setError("Chỉ hỗ trợ file JSON hoặc PDF");
      return;
    }

    try {
      setImporting(true);
      setError(null);

      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(apiUrl("api/characters/import"), {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(errorData.error || "Không thể import nhân vật");
      }

      const character: Character = await response.json();
      onImportSuccess(character);
      onClose();
    } catch (err: any) {
      console.error("Error importing character:", err);
      setError(err.message || "Không thể import nhân vật. Vui lòng kiểm tra file và thử lại.");
    } finally {
      setImporting(false);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        className="relative w-full max-w-md rounded-2xl border border-amber-200 bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-2xl text-ink">Import nhân vật</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            disabled={importing}
          >
            <svg
              className="h-6 w-6"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div
          className={`mb-4 rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
            dragActive
              ? "border-amber-400 bg-amber-50"
              : "border-slate-300 bg-slate-50 hover:border-amber-300"
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={handleClick}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.pdf,application/json,application/pdf"
            onChange={handleFileInputChange}
            className="hidden"
            disabled={importing}
          />
          <svg
            className="mx-auto mb-4 h-12 w-12 text-slate-400"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
          <p className="mb-2 text-sm font-medium text-slate-700">
            Kéo thả file vào đây hoặc click để chọn
          </p>
          <p className="text-xs text-slate-500">
            Hỗ trợ file JSON hoặc PDF character sheet (PDF từ hệ thống này)
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={importing}
            className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-2 text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
          >
            Hủy
          </button>
          <button
            onClick={handleClick}
            disabled={importing}
            className="flex-1 rounded-xl bg-amber-600 px-4 py-2 text-white transition-colors hover:bg-amber-700 disabled:opacity-50"
          >
            {importing ? "Đang import..." : "Chọn file"}
          </button>
        </div>
      </div>
    </div>
  );
}

