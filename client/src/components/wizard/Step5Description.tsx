import type { Character } from "../../types";

interface Step5DescriptionProps {
  character: Partial<Character>;
  onUpdate: (updates: Partial<Character>) => void;
}

const ALIGNMENTS = [
  "Lawful Good",
  "Neutral Good",
  "Chaotic Good",
  "Lawful Neutral",
  "True Neutral",
  "Chaotic Neutral",
  "Lawful Evil",
  "Neutral Evil",
  "Chaotic Evil",
];

export default function Step5Description({
  character,
  onUpdate,
}: Step5DescriptionProps) {
  return (
    <div>
      <h2 className="mb-4 font-display text-2xl text-ink">Bước 5: Mô tả nhân vật</h2>
      <p className="mb-6 text-slate-600">
        Thêm thông tin cá nhân, tính cách và ngoại hình cho nhân vật của bạn.
      </p>

      <div className="space-y-6">
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Tên nhân vật *
          </label>
          <input
            type="text"
            value={character.name || ""}
            onChange={(e) => onUpdate({ name: e.target.value })}
            placeholder="Ví dụ: Bruenor Battlehammer"
            className="w-full rounded-2xl border border-amber-100 bg-white px-4 py-3 text-ink focus:border-amber-400 focus:outline-none"
            required
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Định hướng (Alignment) *
          </label>
          <select
            value={character.alignment || ""}
            onChange={(e) => onUpdate({ alignment: e.target.value })}
            className="w-full rounded-2xl border border-amber-100 bg-white px-4 py-3 text-ink focus:border-amber-400 focus:outline-none"
            required
          >
            <option value="">-- Chọn định hướng --</option>
            {ALIGNMENTS.map((alignment) => (
              <option key={alignment} value={alignment}>
                {alignment}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Tính cách (Personality Traits)
          </label>
          <textarea
            value={character.personalityTraits || ""}
            onChange={(e) => onUpdate({ personalityTraits: e.target.value })}
            placeholder="Mô tả tính cách của nhân vật..."
            rows={3}
            className="w-full rounded-2xl border border-amber-100 bg-white px-4 py-3 text-ink focus:border-amber-400 focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Lý tưởng (Ideals)
          </label>
          <textarea
            value={character.ideals || ""}
            onChange={(e) => onUpdate({ ideals: e.target.value })}
            placeholder="Những gì nhân vật tin tưởng và theo đuổi..."
            rows={3}
            className="w-full rounded-2xl border border-amber-100 bg-white px-4 py-3 text-ink focus:border-amber-400 focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Ràng buộc (Bonds)
          </label>
          <textarea
            value={character.bonds || ""}
            onChange={(e) => onUpdate({ bonds: e.target.value })}
            placeholder="Những gì nhân vật gắn bó và quan tâm..."
            rows={3}
            className="w-full rounded-2xl border border-amber-100 bg-white px-4 py-3 text-ink focus:border-amber-400 focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Điểm yếu (Flaws)
          </label>
          <textarea
            value={character.flaws || ""}
            onChange={(e) => onUpdate({ flaws: e.target.value })}
            placeholder="Những điểm yếu có thể gây rắc rối cho nhân vật..."
            rows={3}
            className="w-full rounded-2xl border border-amber-100 bg-white px-4 py-3 text-ink focus:border-amber-400 focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Tuổi (Age)
            </label>
            <input
              type="text"
              value={character.age || ""}
              onChange={(e) => onUpdate({ age: e.target.value })}
              placeholder="Ví dụ: 25"
              className="w-full rounded-2xl border border-amber-100 bg-white px-4 py-3 text-ink focus:border-amber-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Chiều cao (Height)
            </label>
            <input
              type="text"
              value={character.height || ""}
              onChange={(e) => onUpdate({ height: e.target.value })}
              placeholder="Ví dụ: 5'8&quot;"
              className="w-full rounded-2xl border border-amber-100 bg-white px-4 py-3 text-ink focus:border-amber-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Cân nặng (Weight)
            </label>
            <input
              type="text"
              value={character.weight || ""}
              onChange={(e) => onUpdate({ weight: e.target.value })}
              placeholder="Ví dụ: 150 lbs"
              className="w-full rounded-2xl border border-amber-100 bg-white px-4 py-3 text-ink focus:border-amber-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Màu tóc (Hair)
            </label>
            <input
              type="text"
              value={character.hair || ""}
              onChange={(e) => onUpdate({ hair: e.target.value })}
              placeholder="Ví dụ: Đen"
              className="w-full rounded-2xl border border-amber-100 bg-white px-4 py-3 text-ink focus:border-amber-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Màu mắt (Eyes)
            </label>
            <input
              type="text"
              value={character.eyes || ""}
              onChange={(e) => onUpdate({ eyes: e.target.value })}
              placeholder="Ví dụ: Nâu"
              className="w-full rounded-2xl border border-amber-100 bg-white px-4 py-3 text-ink focus:border-amber-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Màu da (Skin)
            </label>
            <input
              type="text"
              value={character.skin || ""}
              onChange={(e) => onUpdate({ skin: e.target.value })}
              placeholder="Ví dụ: Trắng"
              className="w-full rounded-2xl border border-amber-100 bg-white px-4 py-3 text-ink focus:border-amber-400 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Lịch sử nhân vật (Backstory)
          </label>
          <textarea
            value={character.backstory || ""}
            onChange={(e) => onUpdate({ backstory: e.target.value })}
            placeholder="Kể về quá khứ và lịch sử của nhân vật..."
            rows={5}
            className="w-full rounded-2xl border border-amber-100 bg-white px-4 py-3 text-ink focus:border-amber-400 focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Đồng minh & Tổ chức (Allies & Organizations)
          </label>
          <textarea
            value={character.allies || ""}
            onChange={(e) => onUpdate({ allies: e.target.value })}
            placeholder="Mô tả các đồng minh, tổ chức hoặc mối quan hệ quan trọng..."
            rows={3}
            className="w-full rounded-2xl border border-amber-100 bg-white px-4 py-3 text-ink focus:border-amber-400 focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Tài sản & Kho báu (Treasure)
          </label>
          <textarea
            value={character.treasure || ""}
            onChange={(e) => onUpdate({ treasure: e.target.value })}
            placeholder="Mô tả các tài sản, kho báu hoặc vật phẩm đặc biệt..."
            rows={3}
            className="w-full rounded-2xl border border-amber-100 bg-white px-4 py-3 text-ink focus:border-amber-400 focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Ghi chú
          </label>
          <textarea
            value={character.notes || ""}
            onChange={(e) => onUpdate({ notes: e.target.value })}
            placeholder="Ghi chú thêm về nhân vật..."
            rows={4}
            className="w-full rounded-2xl border border-amber-100 bg-white px-4 py-3 text-ink focus:border-amber-400 focus:outline-none"
          />
        </div>
      </div>
    </div>
  );
}
