# MASTER CONTEXT — AMANAH Platform V2
# Dibaca WAJIB oleh AI sebelum memulai apapun
# Versi: 2.1 | Status: PRODUCTION-SAFE | Terakhir disinkronkan: Juli 2026

---

## 1. STATUS SISTEM SAAT INI (V1 — SUDAH LIVE DI VERCEL)

V1 sudah berjalan di Vercel tanpa error. Semua fitur berikut SUDAH BERFUNGSI dan
TIDAK BOLEH dirusak selama pengerjaan V2:

### Fitur V1 yang sudah live:
- Landing page (hero, features, how it works, CTA, footer)
- Auth: Login (username+password), Signup, Middleware protection
- Dashboard utama (grafik siswa, kedisiplinan, prestasi)
- Data Siswa CRUD (SD/SMP/SMA tabs, bulk import)
- Kedisiplinan: Dashboard + CRUD Data + Master (Kategori, Divisi, Pasal, Tindakan) + Cetak
- Prestasi: Dashboard + CRUD Data + Master (Event, Juara, Bidang, Kategori) + Cetak
- Rekap Poin & Leaderboard (/kedisiplinan/rekap) — Sheet slide-over detail siswa
- Account page (edit profil, upload avatar, ganti password)
- Admin Panel (Overview, Kelola User, Pengumuman)
- Superadmin Panel (Dashboard, Roles, Audit Log, Analytics, Settings)
- Sidebar navigasi per role
- Dark/Light mode toggle

### Database V1 yang sudah ada di Supabase:
profiles, students, kategori_disiplin, divisi, pasal, tindakan,
kedisiplinan, kategori_prestasi, event, juara, bidang, prestasi,
audit_log, announcements

---

## 2. IDENTITAS APLIKASI V2

| Field | Value |
|---|---|
| Nama Baru | AMANAH Platform |
| Kepanjangan | Aplikasi Manajemen Anak & Sekolah |
| Versi | 2.0 |
| Institusi | Sekolah Quran Asy Syahid |
| Dibuat Oleh | [Unggul Sulaiman, S.Kom](https://wa.me/628xxx) |
| InspiraLabs | Link ke https://inspiralabs.id/ |
| Footer | ©2026 [InspiraLabs](https://inspiralabs.id/) · [Unggul Sulaiman, S.Kom](https://wa.me/628xxx) |
| Tagline | Ekosistem Digital Sekolah Terpadu — Guru, Musyrif & Orang Tua |

**PENTING:** Setiap kemunculan teks "SQA Platform", "Nexus-Edu", "NexusEdu"
diganti menjadi "AMANAH Platform" di seluruh codebase HANYA untuk sebagai tampilan.
Setiap kata "InspiraLabs" → link ke https://inspiralabs.id/
Setiap kata "Unggul Sulaiman, S.Kom" → link ke WhatsApp (nomor di .env atau config)

---

## 3. WARNA BARU V2 (MENGGANTIKAN HIJAU & EMAS LAMA)

```css
/* GANTI SELURUH WARNA PRIMARY (hijau lama #2D7A4F) dengan biru slate baru */
--primary: #1e5d7e              /* biru slate utama — menggantikan hijau */
--primary-hover: #174d6a        /* hover lebih gelap */
--primary-light: #e8f4fa        /* muted/bg light */
--primary-foreground: #FFFFFF

/* GANTI SELURUH WARNA SECONDARY (emas lama #C9A84C) dengan biru muda baru */
--secondary: #437793             /* biru muda — menggantikan emas */
--secondary-hover: #366180
--secondary-light: #eaf3f8
--secondary-foreground: #FFFFFF

/* Status colors TIDAK BERUBAH */
--status-red: #DC2626
--status-yellow: #D97706
--status-green: #16A34A
```

Di `tailwind.config.ts`: ganti semua hex lama dengan hex baru di atas.
Di `globals.css`: ganti semua CSS variable lama.

---

## 4. ROLES V2 (EXTENDED)

| Role | Deskripsi | Akses |
|---|---|---|
| user | Guru/Musyrif | Dashboard, Kedisiplinan (Dashboard+Data), Prestasi (Dashboard+Data), Mutabaah, Diknas, About, Akun |
| admin | Administrator | Semua user + Admin Panel (Users, Guru CRUD, OrangTua CRUD, MapelCRUD, Pengumuman, Rekap) |
| superadmin | Super Admin | Semua admin + Superadmin Panel |
| orangtua | Orang Tua Siswa | Dashboard Orang Tua (Mutabaah, Diknas, Kedisiplinan, Prestasi anak) |

**CATATAN PENTING role 'user' (Guru/Musyrif):**
- Guru: punya `mapel_ids[]` — hanya bisa input data sesuai mata pelajarannya
- Musyrif: punya `kamar_ids[]` — hanya bisa input mutabaah untuk kamarnya
- Guru bisa juga musyrif (tipe_role = 'guru_musyrif')
- Multi-mapel: jika `is_multi_mapel=true`, saat input ada dropdown pilih untuk mapel mana

---

## 5. DATABASE V2 — SCHEMA LENGKAP

### Tabel LAMA (V1) — TIDAK BOLEH DIUBAH strukturnya, hanya boleh ALTER ADD COLUMN:

**profiles** — tambah kolom baru:
- tipe_role: text ('guru'|'musyrif'|'guru_musyrif'|'orangtua')
- unit_mengajar: text[] (array: ['SD','SMP','SMA'])
- mapel_ids: uuid[] (FK ke mata_pelajaran)
- kamar_ids: uuid[] (FK ke kamar)
- is_multi_mapel: boolean DEFAULT false
- is_musyrif: boolean DEFAULT false
- pekerjaan: text (untuk orang tua)
- siswa_id: uuid FK → students(id) (untuk orang tua — anak yang dipantau)
- role: CHECK diperluas ke ('user','admin','superadmin','orangtua')

**students** — tambah kolom baru:
- is_alumni: boolean DEFAULT false
- kamar: text (nama kamar pesantren)
- nomor_induk: text

**kedisiplinan** — tambah kolom baru:
- sumber: text DEFAULT 'manual' CHECK IN ('manual','prestasi')
- prestasi_id: uuid FK → prestasi(id)

**prestasi** — tambah kolom baru:
- tipe: text DEFAULT 'siswa' CHECK IN ('siswa','guru')
- guru_id: uuid FK → profiles(id) (jika prestasi guru)
- sudah_dilempar_kedisiplinan: boolean DEFAULT false

**divisi** — kolom unit jadi nullable (tidak wajib unit tertentu)

### Tabel BARU V2:

**mata_pelajaran**
- id: uuid PK
- nama_mapel: text NOT NULL
- kategori: text NOT NULL (contoh: 'DIKNAS SMA', 'KEPESANTRENAN SMP')
- unit: text NOT NULL CHECK IN ('SD','SMP','SMA')
- created_at: timestamptz

**guru** (profil operasional — bisa ada tanpa akun auth)
- id: uuid PK
- nama_lengkap: text NOT NULL
- nip: text
- jenis_kelamin: text CHECK IN ('L','P')
- mapel_ids: uuid[] (wajib untuk tipe guru / guru_musyrif)
- kamar_ids: uuid[] (wajib untuk tipe musyrif / guru_musyrif — FK ke kamar)
- unit: text[] (unit mengajar untuk guru; unit binaan SD/SMP/SMA untuk musyrif)
- tipe: text DEFAULT 'guru' CHECK IN ('guru','musyrif','guru_musyrif')
- email: text
- no_hp: text
- profile_id: uuid FK → profiles(id) nullable
- created_at: timestamptz

> Migrasi DB jika belum ada: `ALTER TABLE guru ADD COLUMN IF NOT EXISTS kamar_ids uuid[] DEFAULT '{}';`

**orangtua**
- id: uuid PK
- nama_lengkap: text NOT NULL
- pekerjaan: text
- email: text
- no_hp: text
- profile_id: uuid FK → profiles(id)
- created_at: timestamptz

**orangtua_siswa** (relasi many-to-many)
- id: uuid PK
- orangtua_id: uuid FK → orangtua(id) CASCADE DELETE
- siswa_id: uuid FK → students(id) CASCADE DELETE
- hubungan: text DEFAULT 'ayah/ibu'
- UNIQUE(orangtua_id, siswa_id)

**tahun_pelajaran**
- id: uuid PK
- nama: text NOT NULL (contoh: '2025/2026')
- tahun_mulai: integer
- tahun_selesai: integer
- is_aktif: boolean DEFAULT false
- created_at: timestamptz

**semester**
- id: uuid PK
- tahun_pelajaran_id: uuid FK → tahun_pelajaran(id) CASCADE
- nomor_semester: integer CHECK IN (1,2)
- tanggal_mulai: date
- tanggal_selesai: date
- is_aktif: boolean DEFAULT false
- created_at: timestamptz

**presensi**
- id: uuid PK
- siswa_id: uuid FK → students(id) CASCADE
- mata_pelajaran_id: uuid FK → mata_pelajaran(id)
- semester_id: uuid FK → semester(id)
- tanggal: date NOT NULL
- status: text CHECK IN ('Hadir','Izin','Sakit','Terlambat','Terlambat Sekali','Istihadhah','Haid','Alpha')
- keterangan: text
- dicatat_oleh: uuid FK → profiles(id)
- created_at: timestamptz

**nilai_harian**
- id: uuid PK
- siswa_id: uuid FK → students(id)
- mata_pelajaran_id: uuid FK → mata_pelajaran(id)
- semester_id: uuid FK → semester(id)
- tipe_nilai: text CHECK IN ('Formatif','Sumatif')
- nama_tugas: text NOT NULL
- materi: text
- bab: text
- nilai_asli: numeric(5,2)
- nilai_remedial: numeric(5,2)
- nilai_final: numeric GENERATED ALWAYS AS (COALESCE(nilai_remedial, nilai_asli)) STORED
- tipe_remedial: text
- bank_soal_id: uuid FK → bank_soal(id)
- is_approved: boolean DEFAULT false
- approved_at: timestamptz
- approved_by: uuid FK → profiles(id)
- dicatat_oleh: uuid FK → profiles(id)
- tanggal: date
- created_at: timestamptz

**nilai_uas**
- id: uuid PK
- siswa_id: uuid FK → students(id)
- mata_pelajaran_id: uuid FK → mata_pelajaran(id)
- semester_id: uuid FK → semester(id)
- nilai_asli: numeric(5,2)
- nilai_remedial: numeric(5,2)
- nilai_final: numeric GENERATED ALWAYS AS (COALESCE(nilai_remedial, nilai_asli)) STORED
- tipe_remedial: text
- bank_soal_id: uuid FK → bank_soal(id)
- is_approved: boolean DEFAULT false
- approved_at: timestamptz
- approved_by: uuid FK → profiles(id)
- dicatat_oleh: uuid FK → profiles(id)
- created_at: timestamptz

**bank_soal**
- id: uuid PK
- judul: text NOT NULL
- tipe: text CHECK IN ('Pilihan Ganda','Essai')
- mata_pelajaran_id: uuid FK → mata_pelajaran(id)
- semester_id: uuid FK → semester(id)
- konten: jsonb
- dibuat_oleh: uuid FK → profiles(id)
- created_at: timestamptz

**catatan_kelakuan**
- id: uuid PK
- siswa_id: uuid FK → students(id)
- semester_id: uuid FK → semester(id)
- tipe: text CHECK IN ('Baik','Kurang Baik')
- catatan: text NOT NULL
- tanggal: date
- dicatat_oleh: uuid FK → profiles(id)
- created_at: timestamptz

**kamar**
- id: uuid PK
- nama_kamar: text NOT NULL
- musyrif_id: uuid FK → profiles(id)
- unit: text CHECK IN ('SD','SMP','SMA')
- created_at: timestamptz

**kegiatan** (mutabaah)
- id: uuid PK
- nama_kegiatan: text NOT NULL
- urutan: integer DEFAULT 0
- poin_target: integer DEFAULT 1
- semester_id: uuid FK → semester(id) nullable (kegiatan bisa di-scope per semester)
- created_at: timestamptz

**sub_kegiatan**
- id: uuid PK
- kegiatan_id: uuid FK → kegiatan(id) CASCADE
- nama_sub: text NOT NULL
- urutan: integer DEFAULT 0
- poin_target: integer DEFAULT 1
- created_at: timestamptz

**mutabaah**
- id: uuid PK
- siswa_id: uuid FK → students(id) CASCADE
- kegiatan_id: uuid FK → kegiatan(id)
- sub_kegiatan_id: uuid FK → sub_kegiatan(id) nullable
- tanggal: date NOT NULL
- status: text CHECK IN ('Hadir','Izin','Sakit','Terlambat','Terlambat Sekali','Istihadhah','Haid','Alpha','L')
- is_libur: boolean DEFAULT false
- dicatat_oleh: uuid FK → profiles(id)
- UNIQUE(siswa_id, kegiatan_id, sub_kegiatan_id, tanggal)
- created_at: timestamptz

**hari_libur**
- id: uuid PK
- tanggal: date NOT NULL UNIQUE
- keterangan: text
- created_at: timestamptz

**target_mutabaah**
- id: uuid PK
- kamar_id: uuid FK → kamar(id)
- kegiatan_id: uuid FK → kegiatan(id)
- sub_kegiatan_id: uuid FK → sub_kegiatan(id) nullable
- semester_id: uuid FK → semester(id)
- target_jumlah: integer DEFAULT 30
- created_at: timestamptz

---

## 6. LOGIKA BISNIS KRITIS V2

### 6.1 Filter Poin Kedisiplinan — STATUS "Sudah Diproses" WAJIB
Semua kalkulasi poin di rekap_poin, dashboard, dan grafik HARUS filter:
```typescript
// WAJIB di semua query kedisiplinan yang menghitung poin
.eq('status', 'Sudah Diproses')
```
Ini berlaku di: getRekapPoin(), getKedisiplinanDashboard(), dashboard.ts, rekap-poin.ts

### 6.2 Alur Prestasi → Kedisiplinan Otomatis
Setiap kali guru input prestasi baru (createPrestasi):
1. Insert record prestasi
2. Cari pasal di tabel pasal WHERE nama_pasal ILIKE `%${tingkat_kejuaraan}%` AND nama_pasal ILIKE `%${nama_juara}%`
3. Insert record kedisiplinan dengan:
   - sumber = 'prestasi'
   - prestasi_id = id prestasi baru
   - status = 'Belum Diproses' (BELUM dihitung di rekap)
   - siswa_id, tanggal, diberikan_oleh dari data prestasi
4. Set prestasi.sudah_dilempar_kedisiplinan = true

**Status implementasi (Juli 2026):**
- Query layer ✅: `getAntrianPoinPrestasi()`, `approveAntrianPoin()` di `kedisiplinan.ts`
- Alur insert otomatis ✅: `createPrestasi()` di `prestasi.ts`
- UI Dashboard ❌ **BELUM**: tabel "Antrian Persetujuan Poin" di `/kedisiplinan` belum dibuat (PRD C5)

Spesifikasi UI (wajib dikerjakan):
Di Dashboard Kedisiplinan tampilkan tabel "Antrian Persetujuan Poin" berisi
kedisiplinan WHERE sumber='prestasi' AND status='Belum Diproses'.
Admin/user klik "Setujui" → UPDATE status='Sudah Diproses' → poin masuk rekap.
Aksi "Tolak" → DELETE record. Bulk "Setujui Semua" untuk baris terpilih.

### 6.3 Alumni Logic
Gunakan kolom **`students.is_alumni`** (boolean) — BUKAN kolom `status` teks.
- `is_alumni = true` → TIDAK muncul di tab SD/SMP/SMA
- `is_alumni = true` → muncul di tab "Alumni"
- Tab Alumni berdampingan dengan SD/SMP/SMA di halaman Data Siswa
- Siswa alumni tidak memiliki relasi aktif dengan kamar, mutabaah, kedisiplinan, catatan kelakuan, presensi, nilai harian, nilai uas, nilai rapor
- Data prestasi alumni tetap dapat ditampilkan

### 6.4 Guru Multi-Mapel & GuruMapelGate
Jika profile.is_multi_mapel=true:
- Saat input presensi/nilai → tampilkan dropdown pilih mapel dari mapel_ids[]
- Setiap record presensi/nilai punya mata_pelajaran_id yang spesifik

**GuruMapelGate** (`diknas/_components/guru-mapel-gate.tsx`):
- Wajib di: presensi, nilai-harian, nilai-uas, bank-soal
- Belum di: catatan kelakuan, rekap-nilai
- Server guard: `assertGuruMapelWriteAccess()` di `diknas.ts`

### 6.5 Nilai Rapor Formula
nilai_rapot = AVERAGE(avg_formatif, avg_sumatif, nilai_uas)
avg_formatif = AVERAGE(semua nilai_harian WHERE tipe_nilai='Formatif' AND siswa_id AND mapel_id AND semester_id, ambil nilai_final)
avg_sumatif = AVERAGE(semua nilai_harian WHERE tipe_nilai='Sumatif' ...)
nilai_uas = nilai_uas.nilai_final

### 6.6 Sistem Nilai A-E Mutabaah
Persentase capaian = (total hadir / target) * 100
A = >= 90%
B = >= 75% dan < 90%
C = >= 60% dan < 75%
D = >= 40% dan < 60%
E = < 40%

**Implementasi UI (`/mutabaah/target`):** target diambil dari `kegiatan.poin_target` / `sub_kegiatan.poin_target` (fallback default 30). Tabel `target_mutabaah` ada di schema tetapi belum dipakai untuk admin CRUD.

### 6.7 Hari Libur → Auto 'L' Mutabaah
Jika tanggal ada di tabel hari_libur:
- Saat input mutabaah: semua status auto-set ke 'L', is_libur=true
- UI: tampilkan banner "Hari ini adalah hari libur. Semua kegiatan otomatis tercatat L."
- Tetap bisa override manual jika diperlukan

### 6.8 Approval Nilai — Orang Tua
nilai_harian dan nilai_uas dengan is_approved=false → TIDAK tampil di dashboard orangtua
Hanya is_approved=true yang tampil untuk role orangtua

### 6.9 Signup Dua Jalur
/signup → pilih tipe: "Orang Tua" atau "Guru / Musyrif"
Orang Tua: role='orangtua', isi siswa_id (cari anak)
Guru: role='user', isi unit_mengajar, mapel_ids, kamar_ids (jika musyrif)
Semua perlu approval admin (is_approved=false dulu)

### 6.10 Halaman Tentang (/about)
**Implementasi saat ini:** satu halaman scroll dengan deskripsi AMANAH + panduan conditional per role (bukan komponen Tabs terpisah).
Akses: dropdown avatar pojok kanan atas → "Tentang".
```
Profile Account (avatar)
   ├─ Akun Saya
   ├─ Tentang  → /about
   └─ Keluar
```
Panduan per role: user/guru, musyrif, admin, superadmin, orangtua — dirender conditional berdasarkan `profile.role` dan `profile.tipe_role`.

---

## 7. STRUKTUR FOLDER V2 (TAMBAHAN DARI V1)

```
src/app/(app)/
├── dashboard/page.tsx
├── students/page.tsx
├── about/page.tsx
├── account/page.tsx
├── mutabaah/
│   ├── page.tsx              ← dashboard mutabaah (getMutabaahDashboardData gabungan)
│   ├── input/page.tsx        ← input checklist harian
│   ├── rekap/page.tsx        ← rekap per kamar/siswa
│   ├── target/page.tsx       ← target & nilai A-E (target dari poin_target kegiatan)
│   ├── kegiatan/page.tsx     ← CRUD kegiatan (admin)
│   ├── sub-kegiatan/page.tsx ← CRUD sub kegiatan (admin)
│   └── cetak/page.tsx        ← cetak laporan mutabaah
├── diknas/
│   ├── page.tsx              ← dashboard diknas
│   ├── presensi/page.tsx     ← CRUD presensi (+ GuruMapelGate)
│   ├── nilai-harian/page.tsx ← CRUD nilai harian (+ GuruMapelGate)
│   ├── nilai-uas/page.tsx    ← CRUD nilai UAS (+ GuruMapelGate)
│   ├── catatan/page.tsx      ← CRUD catatan kelakuan
│   ├── bank-soal/page.tsx    ← CRUD bank soal (+ GuruMapelGate)
│   ├── rekap-nilai/page.tsx  ← rekap nilai rapor
│   ├── laporan-bulanan/page.tsx ← laporan hasil belajar bulanan (guru)
│   └── _components/guru-mapel-gate.tsx ← gate akses mapel guru
├── orangtua/
│   ├── page.tsx              ← dashboard orang tua
│   ├── mutabaah/page.tsx
│   ├── diknas/page.tsx       ← nilai approved only
│   ├── kedisiplinan/page.tsx
│   ├── prestasi/page.tsx
│   └── laporan-bulanan/page.tsx
├── admin/
│   ├── overview/page.tsx
│   ├── users/page.tsx
│   ├── guru/page.tsx         ← CRUD profil operasional guru (tanpa buat auth)
│   ├── orangtua/page.tsx
│   ├── mapel/page.tsx
│   ├── mapel/kelas/page.tsx  ← master kelas
│   ├── tipe-nilai/page.tsx   ← master tipe nilai
│   ├── kamar/page.tsx        ← CRUD kamar + assign musyrif
│   ├── semester/page.tsx     ← manajemen semester & tahun pelajaran
│   └── announcements/page.tsx
├── kedisiplinan/ ... (existing V1)
├── prestasi/ ... (existing V1)
└── superadmin/ ... (existing V1)

src/app/(auth)/
├── login/page.tsx
├── signup/
│   ├── page.tsx              ← pilih jalur signup
│   ├── guru/page.tsx
│   └── orangtua/page.tsx

src/components/
├── providers/query-provider.tsx  ← global React Query defaults
└── layout/sidebar.tsx            ← localStorage: amanah-sidebar-collapsed

src/lib/queries/
├── mutabaah.ts       ← getMutabaahDashboardData() (query gabungan dashboard)
├── diknas.ts         ← assertGuruMapelWriteAccess()
├── admin-extended.ts ← guru/orangtua CRUD + normalizeGuruRelations()
├── semester.ts       ← setActiveSemester/TahunPelajaran (single-active global)
├── orangtua.ts
├── report.ts         ← laporan bulanan guru & orang tua
├── kepesantrenan.ts
├── kamar.ts
└── ... (existing V1 tidak berubah)
```

**PATH_TITLES** di `src/app/(app)/layout.tsx` harus mencakup semua route aktif.
Saat ini belum lengkap: route `/mutabaah/*` staff dan `/orangtua/laporan-bulanan` → header fallback "Halaman".

---

## 8. SIDEBAR MENU V2 PER ROLE

> Sumber kebenaran implementasi: `src/components/layout/sidebar.tsx`
> Filter role: `minRole` + `filterMenuByRole()` — role `user` tidak melihat item `minRole: 'admin'`
> Collapse state: localStorage key `amanah-sidebar-collapsed`

### Role: user (Guru/Musyrif)
```
📊 Dashboard
👥 Data Siswa
📚 Akademik (DIKNAS)
   ├─ Dashboard Diknas
   ├─ Presensi
   ├─ Nilai Harian
   ├─ Nilai UAS
   ├─ Catatan Kelakuan
   ├─ Bank Soal
   ├─ Rekap Nilai
   └─ Laporan Hasil Belajar
🕌 Kepesantrenan (Mutabaah)
   ├─ Dashboard Mutabaah
   ├─ Input Harian
   ├─ Rekap Kegiatan
   ├─ Target & Nilai
   └─ Cetak Laporan
⚖️ Kedisiplinan
   ├─ Dashboard
   ├─ Data
   ├─ Rekap Poin
   └─ Cetak Laporan
🏆 Prestasi
   ├─ Dashboard
   ├─ Data
   └─ Cetak Laporan
```

### Role: admin (semua user +)
```
📚 Akademik — tambahan admin-only:
   ├─ Data Mata Pelajaran
   ├─ Data Kelas
   └─ Tipe Nilai
🕌 Kepesantrenan — tambahan admin-only:
   ├─ Kegiatan
   ├─ Sub Kegiatan
   └─ Data Kamar
⚖️ Kedisiplinan — tambahan admin-only:
   ├─ Kategori, Divisi, Pasal, Tindakan
🏆 Prestasi — tambahan admin-only:
   ├─ Event, Juara, Bidang, Kategori
🛡️ Admin
   ├─ Overview
   ├─ Kelola User
   ├─ Data Guru
   ├─ Data Orang Tua
   ├─ Semester & TP
   └─ Pengumuman
```

### Role: superadmin (semua admin +)
```
⚙️ Superadmin
   ├─ Dashboard
   ├─ Role Management
   ├─ Audit Log
   ├─ Analytics
   └─ System Settings
```

### Role: orangtua
```
🏠 Dashboard
👶 Perkembangan Anak
   ├─ Mutabaah
   ├─ Akademik (Diknas)
   ├─ Kedisiplinan
   ├─ Prestasi
   └─ Laporan Hasil Belajar
```

---

## 9. KOMPONEN V2 — STATUS IMPLEMENTASI

### Sudah ada sebagai file terpisah:
- `src/components/ui/progress.tsx` — progress bar
- `src/components/shared/approval-banner.tsx` — banner nilai belum approve
- `src/components/orangtua/child-selector.tsx` — selector anak
- `src/app/(app)/diknas/_components/guru-mapel-gate.tsx` — gate akses mapel guru

### Logika ada inline di halaman (belum diekstrak ke komponen terpisah):
- Checklist grid mutabaah → `mutabaah/input/page.tsx`
- Banner hari libur → `mutabaah/input/page.tsx`
- Badge nilai A-E → `mutabaah/target/page.tsx`
- Form nilai remedial → inline di `diknas/nilai-harian` & `nilai-uas`

> Komponen di bawah ini OPSIONAL untuk refactor masa depan — jangan wajibkan pembuatan file baru jika logika sudah berfungsi inline:
> `checklist-grid.tsx`, `libur-banner.tsx`, `grade-badge.tsx`, `nilai-form.tsx`

---

## 10. POLA REACT QUERY & PERFORMA (WAJIB IKUTI)

File: `src/components/providers/query-provider.tsx`

```typescript
defaultOptions: {
  queries: {
    refetchOnWindowFocus: false,
    staleTime: 30 * 1000,
    retry: false,
  },
}
```

Aturan tambahan:
1. **`queryKey` wajib mencakup semua filter aktif** — jangan `useEffect` + `refetch()` jika filter sudah di key
2. **Gabungkan query dashboard** yang memakai resolver/filter sama (contoh: `getMutabaahDashboardData()` memanggil `resolveSiswaIds` sekali, lalu `Promise.all`)
3. **`EMPTY_ARRAY` stabil di luar komponen** — jangan `const x = []` di dalam render (hindari re-fetch loop)
4. **`invalidateQueries` harus mencakup cache terkait** setelah mutasi master (mis. `active-semester`, `active-semester-mutabaah`, `active-semester-diknas`)
5. Halaman dashboard boleh override `staleTime` (contoh kedisiplinan: 60 detik)

---

## 11. SEMESTER, TAHUN PELAJARAN & KEAMANAN QUERY SUPABASE

### Aturan single-active (GLOBAL):
- Hanya **1** `tahun_pelajaran.is_aktif = true` dalam seluruh sistem
- Hanya **1** `semester.is_aktif = true` dalam seluruh sistem (bukan per tahun pelajaran)
- Implementasi: `src/lib/queries/semester.ts` — reset semua aktif dulu, baru set yang dipilih

### Larangan filter UUID kosong:
```typescript
// ❌ JANGAN — PostgreSQL error: invalid input syntax for type uuid: ""
.neq('id', '')

// ✅ GUNAKAN
.eq('is_aktif', true)  // untuk reset flag aktif
// atau guard di aplikasi:
if (!id || id.trim() === '') return  // sebelum mutasi
```

### Guard UUID wajib di UI sebelum panggil mutasi:
File: `src/app/(app)/admin/semester/page.tsx` — `handleActivateTahun()`, `handleActivateSemester()`

---

## 12. POIN PRESTASI — MAPPING PASAL (WAJIB INSERT KE SUPABASE)

Sebelum coding, jalankan SUPABASE_MIGRATIONS.sql untuk insert pasal-pasal prestasi.
Poin maksimal 30. Makin tinggi tingkat + makin bagus juara = makin besar poin.

| Tingkat | Juara 1 | Juara 2 | Juara 3 | Peserta Terbaik |
|---|---|---|---|---|
| Sekolah | 3 | 2 | 1 | 1 |
| Lokal/Kecamatan | 6 | 5 | 4 | 3 |
| Kabupaten/Kota | 10 | 8 | 7 | 5 |
| Provinsi | 15 | 13 | 11 | 8 |
| Regional | 18 | 16 | 14 | 10 |
| Nasional | 25 | 22 | 19 | 14 |
| Internasional | 30 | 27 | 24 | 18 |

## 13. POIN 21 DESKRIPSI AMANAH PLATFORM
AMANAH (Aplikasi Manajemen Anak & Sekolah), Amanah adalah platform ekosistem digital sekolah terpadu yang hadir sebagai solusi total untuk menjembatani komunikasi, transparansi, dan pemantauan perkembangan anak secara real-time. 
Dirancang khusus untuk institusi pendidikan modern dan berasrama (pesantren), Amanah mengubah proses pencatatan konvensional yang rumit menjadi satu sistem manajemen digital yang praktis, cepat, dan terintegrasi dalam satu genggaman. Mengapa AMANAH adalah Solusi yang Anda Butuhkan?
Seringkali, perkembangan anak di sekolah—baik dari sisi akademis, karakter, maupun spiritual—terhambat oleh sekat komunikasi antara pihak sekolah, asrama, dan rumah. Amanah hadir memecahkan masalah tersebut dengan menyatukan tiga pilar utama pendidikan: Guru, Musyrif, dan Orang Tua ke dalam satu ekosistem informasi yang transparan dan akurat.
1. Solusi untuk Guru (Manajemen Akademik Tanpa Ribet)
Guru tidak perlu lagi terjebak dalam tumpukan berkas administrasi. Melalui Amanah, guru dapat dengan mudah menginput dan merekap:
- Presensi harian siswa secara digital.
- Nilai harian, tugas, hingga akumulasi nilai akhir semester (rapor) secara otomatis dan sistematis.
2. Solusi untuk Musyrif (Pemantauan Karakter & Spiritual yang Terukur)
Bagi lingkungan asrama atau pesantren, pembentukan karakter adalah prioritas. Amanah memberikan alat bantu digital bagi Musyrif untuk mencatat secara konsisten:
- Mutabaah Yaumiyah: Evaluasi ibadah harian (salat, tilawah, tahfidz, dll.).
- Poin Kedisiplinan & Prestasi: Rekam jejak pelanggaran maupun penghargaan/prestasi yang diraih santri/siswa secara objektif.
3. Solusi Terbesar untuk Orang Tua (Pantauan Informatif & Menentramkan)
Orang tua seringkali merasa cemas dan tidak tahu perkembangan mendetail anak mereka selama di sekolah atau asrama. Amanah memberikan ketenangan pikiran (peace of mind) sebagai solusi pemantauan jarak jauh. Melalui dasbor khusus orang tua yang informatif dan mudah dipahami, mereka dapat melihat:
- Grafik perkembangan nilai dan kehadiran anak.
- Catatan kedisiplinan dan capaian prestasi secara langsung (real-time).
- Laporan ibadah (mutabaah) harian anak, sehingga orang tua tetap bisa membersamai proses tumbuh kembang spiritual anak meski dari rumah.
Nilai Utama Aplikasi AMANAH
- Powerful & Digitalized: Menggantikan cara lama yang manual dengan sistem digitalisasi berbasis data (data-driven) yang aman dan rapi.
- User-Friendly (Kemudahan Akses): Tampilan antarmuka yang intuitif, membuat aplikasi ini sangat mudah dioperasikan oleh guru, musyrif, bahkan oleh orang tua yang gaptek sekalipun.
- Sesuai Maknanya: Setiap data yang diinput adalah bentuk tanggung jawab. Amanah memastikan penyampaian informasi perkembangan anak mengalir secara jujur, tepercaya, dan akurat demi masa depan generasi yang lebih baik.
- Dengan Amanah, manajemen sekolah menjadi lebih efisien, tugas pendidik menjadi lebih ringan, dan orang tua dapat memantau buah hati mereka dengan penuh rasa aman dan bahagia. Amanah: Menjaga Kepercayaan, Membangun Masa Depan