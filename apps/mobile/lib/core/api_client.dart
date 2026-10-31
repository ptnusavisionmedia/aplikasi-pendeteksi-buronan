import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../state/auth_provider.dart';

/// Base URL of the Express API (apps/api). Override at build time with:
/// --dart-define=API_BASE_URL=http://10.0.2.2:4001 (Android emulator) or your LAN IP for a physical device.
const String apiBaseUrl = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: 'http://localhost:4001',
);

final dioProvider = Provider<Dio>((ref) {
  final dio = Dio(BaseOptions(baseUrl: apiBaseUrl, connectTimeout: const Duration(seconds: 15)));

  dio.interceptors.add(InterceptorsWrapper(
    onRequest: (options, handler) {
      final token = ref.read(authProvider).token;
      if (token != null) {
        options.headers['Authorization'] = 'Bearer $token';
      }
      handler.next(options);
    },
    onError: (error, handler) {
      if (error.response?.statusCode == 401) {
        ref.read(authProvider.notifier).logout();
      }
      handler.next(error);
    },
  ));

  return dio;
});

String apiErrorMessage(Object error, [String fallback = 'Terjadi kesalahan, coba lagi.']) {
  // Thrown by a model's fromJson() when the response shape doesn't match what's expected
  // (e.g. CctvFeed.fromJson) — distinct from a network/server error, so it gets its own
  // message instead of falling through to the generic network-failure fallback below.
  if (error is FormatException) return error.message;
  if (error is DioException) {
    final data = error.response?.data;
    if (data is Map && data['error'] is String) return data['error'] as String;
    if (data is Map && data['error'] is Map) {
      final errObj = data['error'] as Map;
      final fieldErrors = errObj['fieldErrors'] as Map?;
      if (fieldErrors != null && fieldErrors.isNotEmpty) {
        final firstList = fieldErrors.values.first;
        if (firstList is List && firstList.isNotEmpty) return firstList.first.toString();
      }
      final formErrors = errObj['formErrors'] as List?;
      if (formErrors != null && formErrors.isNotEmpty) return formErrors.first.toString();
    }
  }
  return fallback;
}
