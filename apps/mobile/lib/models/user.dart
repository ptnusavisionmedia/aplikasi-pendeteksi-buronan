class AppUser {
  final String id;
  final String email;
  final String nama;
  final String role;
  final String? wilayahScope;
  final String? instansiId;

  AppUser({
    required this.id,
    required this.email,
    required this.nama,
    required this.role,
    this.wilayahScope,
    this.instansiId,
  });

  factory AppUser.fromJson(Map<String, dynamic> json) => AppUser(
        id: json['id'] as String,
        email: json['email'] as String,
        nama: json['nama'] as String,
        role: json['role'] as String,
        wilayahScope: json['wilayahScope'] as String?,
        instansiId: json['instansiId'] as String?,
      );

  bool get canEscalate => role == 'ADMIN' || role == 'APARAT' || role == 'KEAMANAN_SWASTA';
}
