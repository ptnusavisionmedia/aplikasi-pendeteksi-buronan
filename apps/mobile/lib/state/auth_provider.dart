import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/api_client.dart';
import '../core/secure_storage.dart';
import '../models/user.dart';

class AuthState {
  final String? token;
  final AppUser? user;
  final bool loading;

  const AuthState({this.token, this.user, this.loading = true});

  bool get isAuthenticated => token != null && user != null;

  AuthState copyWith({String? token, AppUser? user, bool? loading}) => AuthState(
        token: token ?? this.token,
        user: user ?? this.user,
        loading: loading ?? this.loading,
      );
}

class AuthNotifier extends StateNotifier<AuthState> {
  final Ref ref;

  AuthNotifier(this.ref) : super(const AuthState()) {
    _restore();
  }

  // Sebelumnya hanya memulihkan `token` dari secure storage dan tidak pernah mengisi `user` lagi
  // setelah app di-restart — padahal `isAuthenticated` butuh keduanya non-null. Akibatnya setelah
  // restart, token sebenarnya masih valid tapi `isAuthenticated` selalu false, jadi menu "Profil"
  // (yang membaca `isAuthenticated` untuk memutuskan buka /profil atau /login) selalu melempar ke
  // layar login — terasa seperti "langsung logout" padahal sesi aslinya masih ada. Sekarang token
  // yang tersimpan dipakai untuk GET /auth/me dan mengisi ulang `user`; kalau tokennya sudah tidak
  // valid (kedaluwarsa dll), baru benar-benar dianggap logout dan dihapus dari storage.
  Future<void> _restore() async {
    final token = await SecureStorage.readToken();
    if (token == null) {
      state = const AuthState(loading: false);
      return;
    }
    try {
      final dio = ref.read(dioProvider);
      final response = await dio.get('/auth/me', options: Options(headers: {'Authorization': 'Bearer $token'}));
      state = AuthState(token: token, user: AppUser.fromJson(response.data as Map<String, dynamic>), loading: false);
    } catch (_) {
      await SecureStorage.clearToken();
      state = const AuthState(loading: false);
    }
  }

  void setSession(String token, AppUser user) {
    SecureStorage.saveToken(token);
    state = AuthState(token: token, user: user, loading: false);
  }

  Future<void> logout() async {
    await SecureStorage.clearToken();
    state = const AuthState(loading: false);
  }
}

final authProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) => AuthNotifier(ref));
