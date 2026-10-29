class BuronanRef {
  final String id;
  final String nama;
  final String? nomorKasus;

  BuronanRef({required this.id, required this.nama, this.nomorKasus});

  factory BuronanRef.fromJson(Map<String, dynamic> json) => BuronanRef(
        id: json['id'] as String,
        nama: json['nama'] as String,
        nomorKasus: json['nomorKasus'] as String?,
      );
}

class CctvFeedRef {
  final String id;
  final String nama;
  final String lokasi;

  CctvFeedRef({required this.id, required this.nama, required this.lokasi});

  factory CctvFeedRef.fromJson(Map<String, dynamic> json) => CctvFeedRef(
        id: json['id'] as String,
        nama: json['nama'] as String,
        lokasi: json['lokasi'] as String,
      );
}

class EvidenceRef {
  final String id;
  final String fileUrl;

  EvidenceRef({required this.id, required this.fileUrl});

  factory EvidenceRef.fromJson(Map<String, dynamic> json) => EvidenceRef(
        id: json['id'] as String,
        fileUrl: json['fileUrl'] as String,
      );
}

class DetectionEvent {
  final String id;
  final String? cctvFeedId;
  final String? buronanId;
  final double confidenceScore;
  final String status;
  final DateTime detectedAt;
  final BuronanRef? buronan;
  final CctvFeedRef? cctvFeed;
  final EvidenceRef? evidence;

  DetectionEvent({
    required this.id,
    this.cctvFeedId,
    this.buronanId,
    required this.confidenceScore,
    required this.status,
    required this.detectedAt,
    this.buronan,
    this.cctvFeed,
    this.evidence,
  });

  factory DetectionEvent.fromJson(Map<String, dynamic> json) => DetectionEvent(
        id: json['id'] as String,
        cctvFeedId: json['cctvFeedId'] as String?,
        buronanId: json['buronanId'] as String?,
        confidenceScore: (json['confidenceScore'] as num).toDouble(),
        status: json['status'] as String,
        detectedAt: DateTime.parse(json['detectedAt'] as String),
        buronan: json['buronan'] != null ? BuronanRef.fromJson(json['buronan'] as Map<String, dynamic>) : null,
        cctvFeed: json['cctvFeed'] != null ? CctvFeedRef.fromJson(json['cctvFeed'] as Map<String, dynamic>) : null,
        evidence: json['evidence'] != null ? EvidenceRef.fromJson(json['evidence'] as Map<String, dynamic>) : null,
      );
}
