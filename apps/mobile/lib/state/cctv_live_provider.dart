import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/api_client.dart';
import '../models/live_detection_settings.dart';

/// Shared by every live feed view (card thumbnails + Mode Fokus) so they all draw detection
/// boxes using the same admin-configured thresholds/poll cadence as the web dashboard. Falls
/// back to the backend's own defaults on failure instead of blocking the video from playing.
final liveDetectionSettingsProvider = FutureProvider.autoDispose<LiveDetectionSettings>((ref) async {
  final dio = ref.read(dioProvider);
  try {
    final response = await dio.get('/settings');
    return LiveDetectionSettings.fromJson(response.data as Map<String, dynamic>);
  } catch (_) {
    return const LiveDetectionSettings.fallback();
  }
});
