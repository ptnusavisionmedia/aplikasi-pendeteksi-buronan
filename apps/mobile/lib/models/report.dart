class ReportStatus {
  final String ticketId;
  final String status;
  final DateTime createdAt;
  final DateTime? verifiedAt;

  ReportStatus({
    required this.ticketId,
    required this.status,
    required this.createdAt,
    this.verifiedAt,
  });

  factory ReportStatus.fromJson(Map<String, dynamic> json) => ReportStatus(
        ticketId: json['ticketId'] as String,
        status: json['status'] as String,
        createdAt: DateTime.parse(json['createdAt'] as String),
        verifiedAt: json['verifiedAt'] != null ? DateTime.parse(json['verifiedAt'] as String) : null,
      );

  /// Step index for the 4-stage progress bar on the status screen (Diterima → Diverifikasi → Ditindaklanjuti → Selesai).
  int get stepIndex {
    switch (status) {
      case 'MENUNGGU_VERIFIKASI':
        return 1;
      case 'INVESTIGASI_LANJUTAN':
        return 3;
      case 'VALID':
      case 'TIDAK_VALID':
        return 4;
      default:
        return 1;
    }
  }
}
