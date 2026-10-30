/// Read-only view of a CCTV feed for the mobile monitoring screen.
///
/// Mobile never creates/edits/deletes feeds — that management stays on the
/// web dashboard for admins. This mirrors apps/web/src/lib/types.ts
/// `CctvFeed`, minus `urlStream`/`ownerId`, which mobile doesn't need.
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

  factory CctvFeed.fromJson(Map<String, dynamic> json) => CctvFeed(
        id: json['id'] as String,
        nama: json['nama'] as String,
        lokasi: json['lokasi'] as String,
        wilayah: json['wilayah'] as String,
        status: json['status'] as String,
        createdAt: DateTime.parse(json['createdAt'] as String),
      );
}
