import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/api_client.dart';
import '../../core/theme.dart';

/// Public self-registration is Masyarakat-only — the mobile app is a
/// read-only monitoring tool for the public. Staff/admin accounts (Aparat,
/// Keamanan Swasta, Instansi Hukum, Admin) are provisioned directly by the
/// operator, not self-registered here. See apps/api/prisma/seed.ts & ACCOUNT.md.
class RegisterScreen extends ConsumerStatefulWidget {
  const RegisterScreen({super.key});

  @override
  ConsumerState<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends ConsumerState<RegisterScreen> {
  final _namaController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  String? _error;
  String? _success;
  bool _loading = false;

  Future<void> _submit() async {
    setState(() {
      _error = null;
      _success = null;
      _loading = true;
    });
    final dio = ref.read(dioProvider);
    try {
      final response = await dio.post('/auth/register', data: {
        'nama': _namaController.text.trim(),
        'email': _emailController.text.trim(),
        'password': _passwordController.text,
      });
      setState(() => _success = response.data['message'] as String);
      await Future.delayed(const Duration(milliseconds: 1200));
      if (!mounted) return;
      context.pop();
    } catch (err) {
      setState(() => _error = apiErrorMessage(err, 'Registrasi gagal'));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Buat Akun')),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Akun masyarakat untuk memantau status buronan & CCTV.',
                  style: TextStyle(color: AppColors.muted, fontSize: 12.5)),
              const SizedBox(height: 16),
              if (_error != null) ...[
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(color: AppColors.coralSoft, borderRadius: BorderRadius.circular(10)),
                  child: Text(_error!, style: const TextStyle(color: AppColors.coral, fontSize: 12.5)),
                ),
                const SizedBox(height: 12),
              ],
              if (_success != null) ...[
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(color: AppColors.primarySoft, borderRadius: BorderRadius.circular(10)),
                  child: Text(_success!, style: const TextStyle(color: AppColors.primaryInk, fontSize: 12.5)),
                ),
                const SizedBox(height: 12),
              ],
              TextField(controller: _namaController, decoration: const InputDecoration(labelText: 'Nama lengkap')),
              const SizedBox(height: 14),
              TextField(
                controller: _emailController,
                keyboardType: TextInputType.emailAddress,
                decoration: const InputDecoration(labelText: 'Email'),
              ),
              const SizedBox(height: 14),
              TextField(
                controller: _passwordController,
                obscureText: true,
                decoration: const InputDecoration(labelText: 'Password (min. 8 karakter)'),
              ),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _loading ? null : _submit,
                  child: Text(_loading ? 'Memproses...' : 'Daftar'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
