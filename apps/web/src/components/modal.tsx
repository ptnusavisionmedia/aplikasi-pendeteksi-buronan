"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

/**
 * Focused-task overlay: dims and freezes the page behind it so filling a form isn't
 * disturbed by the rest of the layout (cards reflowing, scroll position jumping).
 * Closes via the X button, Escape, or clicking the backdrop — three consistent "back"
 * paths instead of relying on users to notice a toggle button changed state.
 */
export function Modal({
  title,
  description,
  onClose,
  children,
}: {
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/35 backdrop-blur-sm px-4 py-8 sm:py-12"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="glass-strong w-full max-w-lg rounded-[1.25rem] bg-surface/95 overflow-hidden my-auto">
        <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-line">
          <div>
            <h2 className="text-[16px] font-extrabold tracking-tight">{title}</h2>
            {description && <p className="text-[12.5px] text-muted mt-0.5">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="icon-badge bg-canvas hover:bg-line transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>,
    document.body
  );
}
