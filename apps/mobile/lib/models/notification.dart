import 'detection.dart';

class AppNotification {
  final String id;
  final String detectionEventId;
  final String channel;
  final String status;
  final DateTime createdAt;
  final DetectionEvent? detectionEvent;

  AppNotification({
    required this.id,
    required this.detectionEventId,
    required this.channel,
    required this.status,
    required this.createdAt,
    this.detectionEvent,
  });

  factory AppNotification.fromJson(Map<String, dynamic> json) => AppNotification(
        id: json['id'] as String,
        detectionEventId: json['detectionEventId'] as String,
        channel: json['channel'] as String,
        status: json['status'] as String,
        createdAt: DateTime.parse(json['createdAt'] as String),
        detectionEvent: json['detectionEvent'] != null
            ? DetectionEvent.fromJson(json['detectionEvent'] as Map<String, dynamic>)
            : null,
      );
}
