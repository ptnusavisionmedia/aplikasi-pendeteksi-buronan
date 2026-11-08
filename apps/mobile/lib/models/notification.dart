import 'berita_acara.dart';
import 'buronan.dart';
import 'detection.dart';

class AppNotification {
  final String id;
  final String type;
  final String? title;
  final String? body;
  final String? detectionEventId;
  final String? buronanId;
  final String? beritaAcaraId;
  final String channel;
  final String status;
  final bool isRead;
  final DateTime createdAt;
  final DetectionEvent? detectionEvent;
  final Buronan? buronan;
  final BeritaAcara? beritaAcara;

  AppNotification({
    required this.id,
    required this.type,
    this.title,
    this.body,
    this.detectionEventId,
    this.buronanId,
    this.beritaAcaraId,
    required this.channel,
    required this.status,
    required this.isRead,
    required this.createdAt,
    this.detectionEvent,
    this.buronan,
    this.beritaAcara,
  });

  factory AppNotification.fromJson(Map<String, dynamic> json) => AppNotification(
        id: json['id'] as String,
        type: json['type'] as String? ?? 'DETECTION_MATCH',
        title: json['title'] as String?,
        body: json['body'] as String?,
        detectionEventId: json['detectionEventId'] as String?,
        buronanId: json['buronanId'] as String?,
        beritaAcaraId: json['beritaAcaraId'] as String?,
        channel: json['channel'] as String,
        status: json['status'] as String,
        isRead: json['isRead'] as bool? ?? false,
        createdAt: DateTime.parse(json['createdAt'] as String),
        detectionEvent: json['detectionEvent'] != null
            ? DetectionEvent.fromJson(json['detectionEvent'] as Map<String, dynamic>)
            : null,
        buronan: json['buronan'] != null ? Buronan.fromJson(json['buronan'] as Map<String, dynamic>) : null,
        beritaAcara:
            json['beritaAcara'] != null ? BeritaAcara.fromJson(json['beritaAcara'] as Map<String, dynamic>) : null,
      );
}
