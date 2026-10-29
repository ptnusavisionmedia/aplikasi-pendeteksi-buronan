import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/api_client.dart';
import '../../core/theme.dart';
import '../../models/user.dart';
import '../../state/auth_provider.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  String? _error;
  bool _loading = false;

  Future<void> _submit() async {
    setState(() {
      _error = null;
      _loading = true;
    });
    final dio = ref.read(dioProvider);
    try {
      final response = await dio.post('/auth/login', data: {
        'email': _emailController.text.trim(),
        'password': _passwordController.text,
      });
      final data = response.data as Map<String, dynamic>;
      if (data['requiresOtp'] == true) {
        if (!mounted) return;
        context.push('/login/verify-otp', extra: data['pendingToken'] as String);
        return;
      }
      final token = data['token'] as String;
      final me = await dio.get('/auth/me', options: Options(headers: {'Authorization': 'Bearer $token'}));
      ref.read(authProvider.notifier).setSession(token, AppUser.fromJson(me.data as Map<String, dynamic>));
      if (!mounted) return;
      context.go('/home');
    } catch (err) {
      setState(() => _error = apiErrorMessage(err, 'Email atau password salah'));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: 32),
              Row(
                children: [
                  Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(color: AppColors.primary, borderRadius: BorderRadius.circular(10)),
                    child: const Icon(Icons.shield_outlined, color: Colors.white, size: 20),
                  ),
                  const SizedBox(width: 10),
                  const Text('Sigap Buronan', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 17)),
                ],
              ),
              const SizedBox(height: 32),
              const Text('Masuk ke akun Anda', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 20)),
              const SizedBox(height: 4),
              const Text('Gunakan email & password terdaftar.', style: TextStyle(color: AppColors.muted, fontSize: 13)),
              const SizedBox(height: 20),
              if (_error != null) ...[
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(color: AppColors.coralSoft, borderRadius: BorderRadius.circular(10)),
                  child: Text(_error!, style: const TextStyle(color: AppColors.coral, fontSize: 12.5)),
                ),
                const SizedBox(height: 12),
              ],
              TextField(
                controller: _emailController,
                keyboardType: TextInputType.emailAddress,
                decoration: const InputDecoration(labelText: 'Email'),
              ),
              const SizedBox(height: 14),
              TextField(
                controller: _passwordController,
                obscureText: true,
                decoration: const InputDecoration(labelText: 'Password'),
              ),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _loading ? null : _submit,
                  child: Text(_loading ? 'Memproses...' : 'Masuk'),
                ),
              ),
              const SizedBox(height: 16),
              Center(
                child: TextButton(
                  onPressed: () => context.push('/register'),
                  child: const Text('Belum punya akun? Daftar'),
                ),
              ),
              Center(
                child: TextButton(
                  onPressed: () => context.go('/lapor'),
                  child: const Text('Lapor tanpa login →'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
