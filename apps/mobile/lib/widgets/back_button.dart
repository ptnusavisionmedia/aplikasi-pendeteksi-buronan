import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

/// Tombol kembali eksplisit untuk `AppBar.leading` di tiap layar non-Home.
///
/// Flutter sebenarnya sudah otomatis menampilkan ikon kembali di `AppBar` saat
/// `Navigator.canPop()` true (semua layar di sini dinavigasi lewat `context.push`), tapi itu
/// diam-diam hilang kalau layar dibuka langsung lewat URL/deep link (stack cuma berisi satu
/// route, canPop jadi false) — mis. saat mengetes lewat `flutter run -d web-server` dengan
/// refresh/URL manual. Widget ini eksplisit: pop kalau bisa, kalau tidak fallback ke `/home`
/// supaya tombol kembali selalu ada dan selalu mengarah ke tempat yang masuk akal.
class AppBackButton extends StatelessWidget {
  final String fallbackRoute;

  const AppBackButton({super.key, this.fallbackRoute = '/home'});

  @override
  Widget build(BuildContext context) {
    return IconButton(
      icon: const Icon(Icons.arrow_back),
      tooltip: 'Kembali',
      onPressed: () {
        if (context.canPop()) {
          context.pop();
        } else {
          context.go(fallbackRoute);
        }
      },
    );
  }
}
