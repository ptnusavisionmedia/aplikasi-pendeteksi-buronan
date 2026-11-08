/// Read-only view of a CCTV feed for the mobile monitoring screen.
///
/// Mobile never creates/edits/deletes feeds and never controls PTZ — that all stays on the web
/// dashboard for admins (see vault/03-Decisions/2026-10-30 - Monitoring CCTV Read-Only di
/// Mobile.md). Mobile CAN view an ACTIVE feed's live stream (read-only, HLS) since
/// vault/03-Decisions/2026-11-01 - CCTV Live-Streaming Mobile.md — that's not a management
/// capability, so it doesn't need `urlStream` here either: the live URL comes from
/// `POST /cctv-feeds/:id/live` (same MediaMTX relay the web dashboard's Mode Fokus uses), not
/// from this list payload. This mirrors apps/web/src/lib/types.ts `CctvFeed`, deliberately
/// dropping every field only the web dashboard's management/PTZ UI needs: `urlStream`,
/// `ownerId`, `lat`/`lng`, `sourceType`, `ptzSupported`, `onvifPort`. Keep this list in sync
/// whenever a new management-only field is added to the backend model, so it's clear an
/// omission here is intentional rather than mobile having fallen behind.
///
/// `mirror` is the one exception: it's not a management field, it's a display-time correction
/// (some cameras ship pre-flipped) needed to render the live video AND its detection bounding
/// boxes correctly together — see vault/03-Decisions/2026-11-08 - CCTV Live Mobile - Bounding
/// Box dan Kartu Live.md.
class CctvFeed {
  final String id;
  final String nama;
  final String lokasi;
  final String wilayah;
  final String status;
  final bool mirror;
  final DateTime createdAt;

  CctvFeed({
    required this.id,
    required this.nama,
    required this.lokasi,
    required this.wilayah,
    required this.status,
    required this.mirror,
    required this.createdAt,
  });

  factory CctvFeed.fromJson(Map<String, dynamic> json) {
    try {
      return CctvFeed(
        id: json['id'] as String,
        nama: json['nama'] as String? ?? '(tanpa nama)',
        lokasi: json['lokasi'] as String? ?? '-',
        wilayah: json['wilayah'] as String? ?? '-',
        status: json['status'] as String? ?? 'OFFLINE',
        mirror: json['mirror'] as bool? ?? false,
        createdAt: DateTime.tryParse(json['createdAt'] as String? ?? '') ?? DateTime.now(),
      );
    } catch (err) {
      // A malformed/missing `id` is the one field we can't sensibly default — surface a
      // message that points at the real cause instead of the generic network-error fallback
      // apiErrorMessage() would otherwise show for a plain FormatException/TypeError.
      throw FormatException('Data kamera CCTV dari server tidak sesuai format yang diharapkan: $err');
    }
  }
}
