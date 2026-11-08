import 'package:flutter/material.dart';
import '../core/theme.dart';

/// One face the detection engine is currently tracking on a live CCTV feed — mirrors
/// apps/web/src/lib/use-live-detection.ts `DetectedFace`. `bbox` is `[x0, y0, x1, y1]`,
/// normalized 0..1 against the video frame, so it can be positioned against any render size
/// (card thumbnail or full-screen Mode Fokus) without knowing the stream's native resolution.
class DetectedFace {
  final List<double> bbox;
  final double confidence;
  final double ageSeconds;

  const DetectedFace({required this.bbox, required this.confidence, required this.ageSeconds});

  factory DetectedFace.fromJson(Map<String, dynamic> json) {
    final rawBbox = (json['bbox'] as List).map((e) => (e as num).toDouble()).toList();
    return DetectedFace(
      bbox: rawBbox,
      confidence: (json['confidence'] as num).toDouble(),
      ageSeconds: (json['ageSeconds'] as num?)?.toDouble() ?? 0,
    );
  }
}

/// Green < reportThreshold, amber reportThreshold–matchThreshold, coral >= matchThreshold — same
/// cutoffs as apps/web/src/lib/detection-tier.ts, which mirror the admin-editable thresholds in
/// Pengaturan (SystemSetting.detectionMatchThreshold / detectionReportThreshold).
Color tierColorFor(double confidence, double reportThreshold, double matchThreshold) {
  if (confidence >= matchThreshold) return AppColors.coral;
  if (confidence >= reportThreshold) return AppColors.amber;
  return AppColors.safe;
}
