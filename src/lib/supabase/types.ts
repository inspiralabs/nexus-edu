// src/lib/supabase/types.ts

export type Role = 'user' | 'admin' | 'superadmin'
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
  created_at: string
  updated_at: string
}

export interface Student {
  id: string
  nama: string
  kelas: string
  jenis_kelamin: JenisKelamin | null
  unit: Unit | null
  created_at: string
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
  created_at: string
  students?: Student
  event?: Event
  juara?: Juara
  bidang?: Bidang
  kategori_prestasi?: KategoriPrestasi
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
