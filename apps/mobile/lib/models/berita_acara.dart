class BeritaAcara {
  final String id;
  final String judul;
  final String ringkasan;
  final String isi;
  final String? fotoUrl;
  final String status;
  final DateTime? publishedAt;
  final DateTime createdAt;
  final String? penulisNama;

  BeritaAcara({
    required this.id,
    required this.judul,
    required this.ringkasan,
    required this.isi,
    this.fotoUrl,
    required this.status,
    this.publishedAt,
    required this.createdAt,
    this.penulisNama,
  });

  factory BeritaAcara.fromJson(Map<String, dynamic> json) => BeritaAcara(
        id: json['id'] as String,
        judul: json['judul'] as String,
        ringkasan: json['ringkasan'] as String,
        isi: json['isi'] as String,
        fotoUrl: json['fotoUrl'] as String?,
        status: json['status'] as String,
        publishedAt: json['publishedAt'] != null ? DateTime.parse(json['publishedAt'] as String) : null,
        createdAt: DateTime.parse(json['createdAt'] as String),
        penulisNama: (json['penulis'] as Map<String, dynamic>?)?['nama'] as String?,
      );
}
