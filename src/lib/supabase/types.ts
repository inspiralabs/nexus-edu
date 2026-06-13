// src/lib/supabase/types.ts

export type Role = 'user' | 'admin' | 'superadmin' | 'orangtua'
export type Unit = 'SD' | 'SMP' | 'SMA'
export type JenisKelamin = 'L' | 'P'
export type StatusKedisiplinan = 'Belum Diproses' | 'Pending' | 'Sudah Diproses'
export type Tempat = 'Offline' | 'Online'
export type JenisJuara = 'Individu' | 'Kelompok'
export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'APPROVE_USER' | 'CHANGE_ROLE' | 'LOGIN' | 'LOGOUT'

export type TingkatKejuaraan =
  | 'Tingkat Sekolah'
  | 'Tingkat Lokal'
  | 'Tingkat Kecamatan'
  | 'Tingkat Kabupaten/Kota'
  | 'Tingkat Provinsi'
  | 'Tingkat Regional'
  | 'Tingkat Nasional'
  | 'Tingkat Internasional'

export type TipeRole = 'guru' | 'musyrif' | 'guru_musyrif' | 'orangtua'

export interface Profile {
  id: string
  user_id: string | null
  nama_lengkap: string
  guru_mapel: string | null
  username: string
  role: Role
  is_approved: boolean
  avatar_url: string | null
  email: string | null
  tipe_role: TipeRole | null
  unit_mengajar: Unit[] | null
  mapel_ids: string[] | null
  kamar_ids: string[] | null
  is_multi_mapel: boolean | null
  is_musyrif: boolean | null
  created_at: string
  updated_at: string
}

export interface Student {
  id: string
  nama: string
  kelas: string
  jenis_kelamin: JenisKelamin | null
  unit: Unit | null
  is_alumni: boolean | null
  kamar: string | null
  kamar_id: string | null
  nomor_induk: string | null
  created_at: string
  orangtua_siswa?: {
    orangtua_id?: string | null
    hubungan: string
    orangtua: {
      id?: string
      nama_lengkap: string
    } | null
  }[]
}

export interface KategoriDisiplin {
  id: string
  nama_kategori: string
}

export interface Divisi {
  id: string
  nama_divisi: string
  unit: Unit | null
}

export interface Pasal {
  id: string
  nama_pasal: string
  kategori_id: string | null
  poin: number
  kategori_disiplin?: KategoriDisiplin
}

export interface Tindakan {
  id: string
  nama_tindakan: string
  kategori_id: string | null
  kategori_disiplin?: KategoriDisiplin
}

export interface Kedisiplinan {
  id: string
  tanggal: string
  diberikan_oleh: string
  siswa_id: string | null
  kategori_id: string | null
  divisi_id: string | null
  pasal_id: string | null
  tindakan_id: string | null
  status: StatusKedisiplinan
  created_at: string
  students?: Student
  kategori_disiplin?: KategoriDisiplin
  divisi?: Divisi
  pasal?: Pasal
  tindakan?: Tindakan
}

export interface KategoriPrestasi {
  id: string
  nama_kategori: string
}

export interface Event {
  id: string
  nama_event: string
  penyelenggara: string | null
}

export interface Juara {
  id: string
  nama_juara: string
}

export interface Bidang {
  id: string
  nama_bidang: string
}

export interface Prestasi {
  id: string
  unit: Unit | null
  siswa_id: string | null
  event_id: string | null
  tempat: Tempat | null
  waktu: string | null
  juara_id: string | null
  jenis_juara: JenisJuara | null
  bidang_id: string | null
  kategori_id: string | null
  tingkat_kejuaraan: TingkatKejuaraan | null
  tipe: 'siswa' | 'guru' | null
  guru_id: string | null
  sudah_dilempar_kedisiplinan: boolean | null
  created_at: string
  students?: Student
  event?: Event
  juara?: Juara
  bidang?: Bidang
  kategori_prestasi?: KategoriPrestasi
  profiles?: Profile
}

export interface AuditLog {
  id: string
  user_id: string | null
  action: AuditAction | null
  table_name: string | null
  record_id: string | null
  old_data: Record<string, unknown> | null
  new_data: Record<string, unknown> | null
  created_at: string
  profiles?: Profile
}

export interface Announcement {
  id: string
  title: string
  content: string
  created_at: string
}

export type TipeGuru = 'guru' | 'musyrif' | 'guru_musyrif'

export interface MataPelajaran {
  id: string
  nama_mapel: string
  kategori: string
  unit: Unit
  created_at: string
}

export interface Guru {
  id: string
  nama_lengkap: string
  nip: string | null
  jenis_kelamin: JenisKelamin | null
  mapel_ids: string[] | null
  unit: string[] | null
  tipe: TipeGuru
  email: string | null
  no_hp: string | null
  profile_id: string | null
  created_at: string
  profiles?: Pick<Profile, 'id' | 'nama_lengkap' | 'username' | 'email'>
  mata_pelajaran?: MataPelajaran[]
}

export interface OrangTua {
  id: string
  nama_lengkap: string
  pekerjaan: string | null
  email: string | null
  no_hp: string | null
  profile_id: string | null
  created_at: string
  orangtua_siswa?: OrangTuaSiswa[]
}

export interface OrangTuaSiswa {
  id: string
  orangtua_id: string
  siswa_id: string
  hubungan: string
  students?: Student
}

export interface Kamar {
  id: string
  nama_kamar: string
  musyrif_id: string | null
  unit: Unit
  created_at: string
  profiles?: Profile
}

// ─── DIKNAS (Fase F) ───────────────────────────────────────────────────────────

export type PresensiStatus =
  | 'Hadir'
  | 'Izin'
  | 'Sakit'
  | 'Terlambat'
  | 'Terlambat Sekali'
  | 'Istihadhah'
  | 'Haid'
  | 'Alpha'

export type TipeNilai = 'Formatif' | 'Sumatif'

export type TipeBankSoal = 'Pilihan Ganda' | 'Essai'

export type TipeCatatanKelakuan = 'Baik' | 'Kurang Baik'

export interface TahunPelajaran {
  id: string
  nama: string
  tahun_mulai: number
  tahun_selesai: number
  is_aktif: boolean
  created_at: string
}

export interface Semester {
  id: string
  tahun_pelajaran_id: string
  nomor_semester: 1 | 2
  tanggal_mulai: string
  tanggal_selesai: string
  is_aktif: boolean
  created_at: string
  tahun_pelajaran?: TahunPelajaran
}

export interface Presensi {
  id: string
  siswa_id: string
  mata_pelajaran_id: string
  semester_id: string | null
  tanggal: string
  status: PresensiStatus
  keterangan: string | null
  dicatat_oleh: string | null
  created_at: string
}

export interface NilaiHarian {
  id: string
  siswa_id: string
  mata_pelajaran_id: string
  semester_id: string | null
  tipe_nilai: TipeNilai
  nama_tugas: string
  materi: string | null
  bab: string | null
  nilai_asli: number | null
  nilai_remedial: number | null
  nilai_final: number | null
  tipe_remedial: string | null
  bank_soal_id: string | null
  is_approved: boolean
  approved_at: string | null
  approved_by: string | null
  dicatat_oleh: string | null
  tanggal: string | null
  created_at: string
}

export interface NilaiUAS {
  id: string
  siswa_id: string
  mata_pelajaran_id: string
  semester_id: string | null
  nilai_asli: number | null
  nilai_remedial: number | null
  nilai_final: number | null
  tipe_remedial: string | null
  bank_soal_id: string | null
  is_approved: boolean
  approved_at: string | null
  approved_by: string | null
  dicatat_oleh: string | null
  created_at: string
}

export interface BankSoal {
  id: string
  judul: string
  tipe: TipeBankSoal
  mata_pelajaran_id: string | null
  semester_id: string | null
  konten: Record<string, unknown> | null
  dibuat_oleh: string | null
  created_at: string
}

export interface CatatanKelakuan {
  id: string
  siswa_id: string
  semester_id: string | null
  tipe: TipeCatatanKelakuan
  catatan: string
  tanggal: string | null
  dicatat_oleh: string | null
  created_at: string
}
