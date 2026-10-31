/// Read-only view of a CCTV feed for the mobile monitoring screen.
///
/// Mobile never creates/edits/deletes feeds, never plays their video, and
/// never controls PTZ — that all stays on the web dashboard for admins (see
/// vault/03-Decisions/2026-10-30 - Monitoring CCTV Read-Only di Mobile.md).
/// This mirrors apps/web/src/lib/types.ts `CctvFeed`, deliberately dropping
/// every field only the web dashboard's management/streaming/PTZ UI needs:
/// `urlStream`, `ownerId`, `lat`/`lng`, `sourceType`, `ptzSupported`,
/// `onvifPort`, `mirror` (web-only video correction — mobile has no video
/// to mirror). Keep this list in sync whenever a new management-only field
/// is added to the backend model, so it's clear an omission here is
/// intentional rather than mobile having fallen behind.
class CctvFeed {
  final String id;
  final String nama;
  final String lokasi;
  final String wilayah;
  final String status;
  final DateTime createdAt;

  CctvFeed({
    required this.id,
    required this.nama,
    required this.lokasi,
    required this.wilayah,
    required this.status,
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
