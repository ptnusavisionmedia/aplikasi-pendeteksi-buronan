class BuronanFoto {
  final String urlFoto;

  BuronanFoto({required this.urlFoto});

  factory BuronanFoto.fromJson(Map<String, dynamic> json) => BuronanFoto(urlFoto: json['urlFoto'] as String);
}

class Buronan {
  final String id;
  final String nama;
  final String nomorKasus;
  final String tingkatAncaman;
  final String status;
  final List<BuronanFoto> fotos;

  Buronan({
    required this.id,
    required this.nama,
    required this.nomorKasus,
    required this.tingkatAncaman,
    required this.status,
    required this.fotos,
  });

  String? get fotoUtamaUrl => fotos.isNotEmpty ? fotos.first.urlFoto : null;

  factory Buronan.fromJson(Map<String, dynamic> json) => Buronan(
        id: json['id'] as String,
        nama: json['nama'] as String,
        nomorKasus: json['nomorKasus'] as String,
        tingkatAncaman: json['tingkatAncaman'] as String,
        status: json['status'] as String,
        fotos: (json['fotos'] as List? ?? [])
            .map((e) => BuronanFoto.fromJson(e as Map<String, dynamic>))
            .toList(),
      );
}
