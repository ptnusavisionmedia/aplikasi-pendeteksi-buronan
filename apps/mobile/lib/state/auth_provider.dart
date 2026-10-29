import 'package:flutter_riverpod/flutter_riverpod.dart';
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
  AuthNotifier() : super(const AuthState()) {
    _restore();
  }

  Future<void> _restore() async {
    final token = await SecureStorage.readToken();
    state = AuthState(token: token, loading: false);
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

final authProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) => AuthNotifier());
