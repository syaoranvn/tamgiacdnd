import { useEffect, useState } from "react";
import type { Character } from "../types";
import { apiUrl } from "../config/api";
import ConfirmDialog from "./ConfirmDialog";
import ImportCharacterDialog from "./ImportCharacterDialog";

interface CharacterSelectorProps {
  onSelectCharacter: (character: Character) => void;
  onCreateNew: () => void;
}

export default function CharacterSelector({
  onSelectCharacter,
  onCreateNew,
}: CharacterSelectorProps) {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [creatingSample, setCreatingSample] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    characterId: string;
    characterName: string;
  }>({
    isOpen: false,
    characterId: "",
    characterName: "",
  });

  useEffect(() => {
    loadCharacters();
  }, []);

  const loadCharacters = async () => {
    try {
      setLoading(true);
      const response = await fetch(apiUrl("api/characters"));
      if (!response.ok) throw new Error("Không thể tải danh sách nhân vật");
      const data = await response.json();
      setCharacters(data);
    } catch (err) {
      console.warn("Không thể kết nối server:", err);
      setError("Không thể kết nối server");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (characterId: string, characterName: string) => {
    setConfirmDialog({
      isOpen: true,
      characterId,
      characterName: characterName || "Chưa đặt tên",
    });
  };

  const handleDeleteConfirm = async () => {
    const { characterId } = confirmDialog;
    try {
      setDeletingId(characterId);
      const response = await fetch(apiUrl(`api/characters/${characterId}`), {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Không thể xóa nhân vật");
      }

      // Reload character list
      await loadCharacters();
      setConfirmDialog({ isOpen: false, characterId: "", characterName: "" });
    } catch (err) {
      console.error("Error deleting character:", err);
      setConfirmDialog({ isOpen: false, characterId: "", characterName: "" });
      setError("Không thể xóa nhân vật. Vui lòng thử lại.");
      setTimeout(() => setError(null), 5000);
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteCancel = () => {
    setConfirmDialog({ isOpen: false, characterId: "", characterName: "" });
  };

  const handleCreateSample = async () => {
    try {
      setCreatingSample(true);
      setError(null);
      const response = await fetch(apiUrl("api/characters/sample"), {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Không thể tạo nhân vật mẫu");
      }

      await loadCharacters();
    } catch (err) {
      console.error("Error creating sample character:", err);
      setError("Không thể tạo nhân vật mẫu. Vui lòng thử lại.");
      setTimeout(() => setError(null), 5000);
    } finally {
      setCreatingSample(false);
    }
  };

  const handleImportSuccess = async (character: Character) => {
    await loadCharacters();
  };

  const handleExportPDF = async (characterId: string, characterName: string) => {
    try {
      setExportingId(characterId);
      const response = await fetch(apiUrl(`api/characters/${characterId}/export-pdf`), {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Không thể tạo PDF");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${characterName || "character"}_sheet.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Error exporting PDF:", error);
      setError("Không thể export PDF. Vui lòng thử lại.");
      setTimeout(() => setError(null), 5000);
    } finally {
      setExportingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 text-lg text-slate-600">Đang tải...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-10 sm:px-8">
      <div className="mx-auto max-w-4xl">
        <header className="mb-8 rounded-3xl border border-amber-200 bg-white/70 p-8 shadow-sheet backdrop-blur">
          <p className="text-sm uppercase tracking-[0.3em] text-amber-700">
            Tam Giác | D&D 5e
          </p>
          <h1 className="mt-3 font-display text-4xl text-ink sm:text-5xl">
            Quản lý nhân vật
          </h1>
          <p className="mt-2 text-base text-slate-600">
            Chọn nhân vật có sẵn hoặc tạo nhân vật mới
          </p>
        </header>

        {error && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
            {error}
          </div>
        )}

        {characters.length > 0 ? (
          <div className="mb-8">
            <h2 className="mb-4 font-display text-2xl text-ink">
              Nhân vật đã tạo ({characters.length})
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {characters.map((char) => (
                <div
                  key={char.id}
                  className="group relative rounded-2xl border border-amber-100 bg-white/80 p-6 shadow-sm transition-all hover:border-amber-300 hover:shadow-md"
                >
                  <button
                    onClick={() => onSelectCharacter(char)}
                    className="w-full text-left"
                  >
                    <div className="mb-2 font-display text-xl text-ink">
                      {char.name || "Chưa đặt tên"}
                    </div>
                    <div className="space-y-1 text-sm text-slate-600">
                      <div>
                        <span className="font-medium">Chủng tộc:</span> {char.race}
                      </div>
                      <div>
                        <span className="font-medium">Lớp:</span> {char.className}
                      </div>
                      <div>
                        <span className="font-medium">Cấp độ:</span> {char.level}
                      </div>
                      {char.createdAt && (
                        <div className="mt-2 text-xs text-slate-400">
                          Tạo: {new Date(char.createdAt).toLocaleDateString("vi-VN")}
                        </div>
                      )}
                    </div>
                  </button>
                  <div className="absolute top-2 right-2 flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleExportPDF(char.id, char.name || "Chưa đặt tên");
                      }}
                      disabled={exportingId === char.id}
                      className="rounded-lg bg-blue-50 p-2 text-blue-600 transition-all hover:bg-blue-100 disabled:opacity-50"
                      title="Export PDF"
                    >
                      {exportingId === char.id ? (
                        <svg className="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      ) : (
                        <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      )}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteClick(char.id, char.name || "Chưa đặt tên");
                      }}
                      disabled={deletingId === char.id}
                      className="rounded-lg bg-red-50 p-2 text-red-600 transition-all hover:bg-red-100 disabled:opacity-50"
                      title="Xóa nhân vật"
                    >
                    {deletingId === char.id ? (
                      <svg
                        className="h-4 w-4 animate-spin"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                    ) : (
                      <svg
                        className="h-4 w-4"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="mb-8 rounded-2xl border border-amber-100 bg-amber-50/50 p-8 text-center">
            <p className="text-slate-600">Chưa có nhân vật nào được tạo</p>
          </div>
        )}

        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <button
            onClick={handleCreateSample}
            disabled={creatingSample}
            className="flex items-center justify-center rounded-2xl border border-amber-200 bg-white px-6 py-3 font-medium text-amber-700 shadow-sm transition-all hover:bg-amber-50 disabled:opacity-60"
          >
            {creatingSample ? "Đang tạo demo..." : "⚡ Tạo nhân vật demo"}
          </button>
          <button
            onClick={() => setShowImportDialog(true)}
            className="flex items-center justify-center rounded-2xl border border-blue-200 bg-white px-6 py-3 font-medium text-blue-700 shadow-sm transition-all hover:bg-blue-50"
          >
            <svg className="mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Import nhân vật
          </button>
          <button
            onClick={onCreateNew}
            className="rounded-2xl bg-amber-600 px-8 py-4 font-display text-lg text-white shadow-lg transition-all hover:bg-amber-700 hover:shadow-xl"
          >
            + Tạo nhân vật mới
          </button>
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title="Xác nhận xóa nhân vật"
        message={`Bạn có chắc chắn muốn xóa nhân vật "${confirmDialog.characterName}"?\n\nHành động này không thể hoàn tác.`}
        confirmText="Xóa"
        cancelText="Hủy"
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
        type="confirm"
      />

      <ImportCharacterDialog
        isOpen={showImportDialog}
        onClose={() => setShowImportDialog(false)}
        onImportSuccess={handleImportSuccess}
      />
    </div>
  );
}

