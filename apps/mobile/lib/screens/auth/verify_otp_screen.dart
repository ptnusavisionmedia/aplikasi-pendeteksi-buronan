import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/api_client.dart';
import '../../core/theme.dart';
import '../../models/user.dart';
import '../../state/auth_provider.dart';

class VerifyOtpScreen extends ConsumerStatefulWidget {
  final String pendingToken;

  const VerifyOtpScreen({super.key, required this.pendingToken});

  @override
  ConsumerState<VerifyOtpScreen> createState() => _VerifyOtpScreenState();
}

class _VerifyOtpScreenState extends ConsumerState<VerifyOtpScreen> {
  final _otpController = TextEditingController();
  String? _error;
  bool _loading = false;

  Future<void> _submit() async {
    setState(() {
      _error = null;
      _loading = true;
    });
    final dio = ref.read(dioProvider);
    try {
      final response = await dio.post('/auth/login/verify-otp', data: {
        'pendingToken': widget.pendingToken,
        'otp': _otpController.text.trim(),
      });
      final token = response.data['token'] as String;
      final me = await dio.get('/auth/me');
      ref.read(authProvider.notifier).setSession(token, AppUser.fromJson(me.data as Map<String, dynamic>));
      if (!mounted) return;
      context.go('/home');
    } catch (err) {
      setState(() => _error = apiErrorMessage(err, 'Kode OTP salah atau kedaluwarsa'));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Verifikasi OTP')),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Verifikasi Dua Faktor', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 20)),
              const SizedBox(height: 4),
              const Text('Masukkan 6 digit kode dari aplikasi autentikator Anda.',
                  style: TextStyle(color: AppColors.muted, fontSize: 13)),
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
                controller: _otpController,
                keyboardType: TextInputType.number,
                maxLength: 6,
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 20, letterSpacing: 6),
                decoration: const InputDecoration(labelText: 'Kode OTP', counterText: ''),
              ),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _loading ? null : _submit,
                  child: Text(_loading ? 'Memverifikasi...' : 'Verifikasi'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
