"use client";

import { useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Bold,
  Italic,
  Heading2,
  Link as LinkIcon,
  Image as ImageIcon,
  List,
  ListOrdered,
  Quote,
  Code,
  Eye,
  Pencil,
} from "lucide-react";
import clsx from "clsx";
import { apiClient, apiErrorMessage } from "@/lib/api-client";

type Snippet = { before: string; after: string; placeholder: string };

const TOOLBAR: { icon: typeof Bold; label: string; snippet: Snippet }[] = [
  { icon: Bold, label: "Tebal", snippet: { before: "**", after: "**", placeholder: "teks tebal" } },
  { icon: Italic, label: "Miring", snippet: { before: "_", after: "_", placeholder: "teks miring" } },
  { icon: Heading2, label: "Subjudul", snippet: { before: "## ", after: "", placeholder: "Subjudul" } },
  { icon: Quote, label: "Kutipan", snippet: { before: "> ", after: "", placeholder: "Kutipan" } },
  { icon: List, label: "Daftar", snippet: { before: "- ", after: "", placeholder: "Poin" } },
  { icon: ListOrdered, label: "Daftar bernomor", snippet: { before: "1. ", after: "", placeholder: "Poin" } },
  { icon: Code, label: "Kode", snippet: { before: "`", after: "`", placeholder: "kode" } },
  { icon: LinkIcon, label: "Tautan", snippet: { before: "[", after: "](https://)", placeholder: "teks tautan" } },
];

/** Editor markdown sederhana untuk konten CMS Berita Acara — toolbar menyisip sintaks markdown
 * langsung ke textarea (bukan WYSIWYG contenteditable), plus tab Pratinjau yang merender hasilnya
 * lewat react-markdown. "Sisipkan Gambar" mengunggah file ke `POST /berita-acara/media` dan
 * menyisipkan `![...](url)` — memberi kebebasan menata konten (gambar, heading, list, kutipan,
 * tautan) tanpa membangun editor WYSIWYG penuh ala WordPress. */
export function MarkdownEditor({
  value,
  onChange,
  rows = 10,
}: {
  value: string;
  onChange: (next: string) => void;
  rows?: number;
}) {
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  function applySnippet(snippet: Snippet) {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = value.slice(start, end) || snippet.placeholder;
    const next = value.slice(0, start) + snippet.before + selected + snippet.after + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      const cursor = start + snippet.before.length + selected.length + snippet.after.length;
      el.setSelectionRange(cursor, cursor);
    });
  }

  function insertAtCursor(text: string) {
    const el = textareaRef.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    onChange(value.slice(0, start) + text + value.slice(end));
  }

  async function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await apiClient.post<{ url: string }>("/berita-acara/media", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      insertAtCursor(`\n![${file.name}](${res.data.url})\n`);
    } catch (err) {
      setUploadError(apiErrorMessage(err, "Gagal mengunggah gambar"));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="border border-line rounded-xl overflow-hidden">
      <div className="flex items-center justify-between gap-2 bg-canvas px-2 py-1.5 border-b border-line">
        <div className="flex items-center gap-0.5 flex-wrap">
          {TOOLBAR.map(({ icon: Icon, label, snippet }) => (
            <button
              key={label}
              type="button"
              title={label}
              onClick={() => applySnippet(snippet)}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-muted hover:bg-line hover:text-ink transition-colors"
            >
              <Icon className="w-3.5 h-3.5" />
            </button>
          ))}
          <button
            type="button"
            title="Sisipkan Gambar"
            disabled={uploading}
            onClick={() => imageInputRef.current?.click()}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-muted hover:bg-line hover:text-ink transition-colors disabled:opacity-50"
          >
            <ImageIcon className="w-3.5 h-3.5" />
          </button>
          <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={onPickImage} />
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setTab("edit")}
            className={clsx(
              "flex items-center gap-1 px-2 py-1 rounded-lg text-[11.5px] font-semibold",
              tab === "edit" ? "bg-primary text-white" : "text-muted hover:bg-line"
            )}
          >
            <Pencil className="w-3 h-3" /> Tulis
          </button>
          <button
            type="button"
            onClick={() => setTab("preview")}
            className={clsx(
              "flex items-center gap-1 px-2 py-1 rounded-lg text-[11.5px] font-semibold",
              tab === "preview" ? "bg-primary text-white" : "text-muted hover:bg-line"
            )}
          >
            <Eye className="w-3 h-3" /> Pratinjau
          </button>
        </div>
      </div>

      {uploading && <p className="px-3 py-1 text-[11.5px] text-muted">Mengunggah gambar...</p>}
      {uploadError && <p className="px-3 py-1 text-[11.5px] text-coral">{uploadError}</p>}

      {tab === "edit" ? (
        <textarea
          ref={textareaRef}
          required
          rows={rows}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Tulis isi berita acara di sini — mendukung markdown: **tebal**, _miring_, ## subjudul, [tautan](url), daftar, kutipan, dll."
          className="w-full px-3.5 py-2.5 text-[13.5px] outline-none resize-none font-mono"
        />
      ) : (
        <div className="px-3.5 py-2.5 text-[13.5px] prose-berita min-h-[120px]">
          {value.trim() ? (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown>
          ) : (
            <p className="text-muted italic">Belum ada konten untuk dipratinjau.</p>
          )}
        </div>
      )}
    </div>
  );
}
