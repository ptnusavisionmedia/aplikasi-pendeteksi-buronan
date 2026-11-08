/// Admin-configured thresholds/cadence for the live detection overlay — mirrors the subset of
/// GET /settings that apps/web/src/components/live-feed-video.tsx reads, so mobile draws the
/// same boxes with the same colors at the same rate as the web dashboard.
class LiveDetectionSettings {
  final int pollIntervalMs;
  final double reportThreshold;
  final double matchThreshold;

  const LiveDetectionSettings({
    required this.pollIntervalMs,
    required this.reportThreshold,
    required this.matchThreshold,
  });

  const LiveDetectionSettings.fallback()
      : pollIntervalMs = 1200,
        reportThreshold = 0.5,
        matchThreshold = 0.7;

  factory LiveDetectionSettings.fromJson(Map<String, dynamic> json) {
    return LiveDetectionSettings(
      pollIntervalMs: (json['liveDetectionPollIntervalMs'] as num?)?.toInt() ?? 1200,
      reportThreshold: (json['detectionReportThreshold'] as num?)?.toDouble() ?? 0.5,
      matchThreshold: (json['detectionMatchThreshold'] as num?)?.toDouble() ?? 0.7,
    );
  }
}
