---
tags: [template, decision, design]
date: 2026-10-29
status: accepted
---

# Pemilihan Arah Desain UI — Bento (Design 4)

- **Tanggal:** 2026-10-29
- **Status:** accepted
- **Konteks terkait:** [[PRD]], `ui-references/design-4-bento/`

## Konteks
6 eksplorasi desain UI dibuat di `ui-references/` (3 native HTML/CSS/JS, 3 lagi pakai Tailwind CDN + Lucide icons + Google Fonts: Bento, Minimalist Clean, Mix Bento+Minimalist). Perlu dipilih satu arah visual sebagai dasar implementasi UI nyata (Next.js web + Flutter mobile).

## Opsi yang Dipertimbangkan
1. **Design 1 — Command Center** (dark tactical) / **Design 2 — Civic Trust** (light official) / **Design 3 — Modern SaaS** (light rounded) — native HTML/CSS/JS, dibuat di eksplorasi pertama.
2. **Design 4 — Bento** — grid bento asimetris, warm-neutral (`#f5f6f2`/emerald `#0c6b4f`), font Figtree, Lucide icons, Tailwind CDN.
3. **Design 5 — Minimalist Clean** — hairline border, aksen cobalt tunggal, font DM Sans.
4. **Design 6 — Mix (Editorial Bento Dark)** — bento + minimalist, dark charcoal, aksen dusty-amber, font IBM Plex Sans.

## Keputusan
Dipilih **Design 4 — Bento** (`ui-references/design-4-bento/`) sebagai arah visual resmi untuk implementasi aplikasi (Next.js web + Flutter mobile). Palet warna (ink `#1b2420`, canvas `#f5f6f2`, primary emerald `#0c6b4f`, coral `#e2503b`, amber `#c6860f`), font Figtree, dan pola grid bento asimetris menjadi acuan desain yang dipakai saat membangun UI nyata (bukan hanya referensi statis).

## Konsekuensi
- Implementasi UI (Next.js web, Flutter mobile) akan mengikuti sistem desain Bento: palet warna, tipografi Figtree, pola kartu bento (`bento-cell`), ikon Lucide (web) / setara di Flutter (mobile).
- 5 arah desain lain (`design-1` hingga `design-3`, `design-5`, `design-6`) tetap disimpan di `ui-references/` sebagai arsip referensi, tidak dihapus.
- Task list implementasi (`vault/06-Tasks/Tasks.md`) dimulai mengikuti urutan: Setup & Infra → Auth/RBAC → Database Buronan + Detection Engine → CCTV/Deteksi → Notifikasi/Eskalasi → Pelaporan, dengan UI web/mobile menyusul tiap modul backend-nya siap, mengikuti sistem desain Bento di atas.
