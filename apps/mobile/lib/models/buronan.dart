class BuronanFoto {
  final String id;
  final String urlFoto;
  final bool isPrimary;

  BuronanFoto({required this.id, required this.urlFoto, required this.isPrimary});

  factory BuronanFoto.fromJson(Map<String, dynamic> json) => BuronanFoto(
        id: json['id'] as String? ?? json['urlFoto'] as String,
        urlFoto: json['urlFoto'] as String,
        isPrimary: json['isPrimary'] as bool? ?? false,
      );
}

class Buronan {
  final String id;
  final String nama;
  final String? nik;
  final String nomorKasus;
  final String tingkatAncaman;
  final String status;
  final List<BuronanFoto> fotos;
  final DateTime? createdAt;

  Buronan({
    required this.id,
    required this.nama,
    this.nik,
    required this.nomorKasus,
    required this.tingkatAncaman,
    required this.status,
    required this.fotos,
    this.createdAt,
  });

  String? get fotoUtamaUrl => fotos.isNotEmpty ? fotos.first.urlFoto : null;

  factory Buronan.fromJson(Map<String, dynamic> json) => Buronan(
        id: json['id'] as String,
        nama: json['nama'] as String,
        nik: json['nik'] as String?,
        nomorKasus: json['nomorKasus'] as String,
        tingkatAncaman: json['tingkatAncaman'] as String,
        status: json['status'] as String,
        fotos: (json['fotos'] as List? ?? [])
            .map((e) => BuronanFoto.fromJson(e as Map<String, dynamic>))
            .toList(),
        createdAt: json['createdAt'] != null ? DateTime.tryParse(json['createdAt'] as String) : null,
      );
}

/// Satu baris riwayat deteksi untuk buronan ini — subset ringkas dari DetectionEvent, cukup
/// untuk daftar "Riwayat Deteksi" di layar detail (mirip apps/web/src/app/(dashboard)/buronan/
/// [id]/page.tsx). Lihat models/detection.dart untuk model DetectionEvent lengkap yang dipakai
/// layar Deteksi/Detail Deteksi.
class BuronanDetectionSummary {
  final String id;
  final double confidenceScore;
  final String status;
  final DateTime detectedAt;

  BuronanDetectionSummary({
    required this.id,
    required this.confidenceScore,
    required this.status,
    required this.detectedAt,
  });

  factory BuronanDetectionSummary.fromJson(Map<String, dynamic> json) => BuronanDetectionSummary(
        id: json['id'] as String,
        confidenceScore: (json['confidenceScore'] as num).toDouble(),
        status: json['status'] as String,
        detectedAt: DateTime.tryParse(json['detectedAt'] as String? ?? '') ?? DateTime.now(),
      );
}

/// GET /buronan/:id — sama seperti `Buronan` tapi dengan SELURUH foto terdaftar (bukan hanya
/// foto utama seperti payload daftar `/buronan`) dan riwayat deteksi terbaru. Dipisah dari
/// `Buronan` supaya layar daftar tidak diam-diam membawa beban `detectionEvents` yang tidak
/// dipakainya.
class BuronanDetail {
  final Buronan buronan;
  final List<BuronanDetectionSummary> detectionEvents;

  BuronanDetail({required this.buronan, required this.detectionEvents});

  factory BuronanDetail.fromJson(Map<String, dynamic> json) => BuronanDetail(
        buronan: Buronan.fromJson(json),
        detectionEvents: (json['detectionEvents'] as List? ?? [])
            .map((e) => BuronanDetectionSummary.fromJson(e as Map<String, dynamic>))
            .toList(),
      );
}
