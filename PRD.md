# PRD V2 — AMANAH Platform
# Aplikasi Manajemen Anak & Sekolah
# Version: 2.1 | Upgrade dari SQA Platform V1
# STATUS: SUMBER KEBENARAN TUNGGAL V2 — BACA DULU SEBELUM KODE APAPUN
#
# Alias file: PRD.md = PRD_V2.md (gunakan PRD.md sebagai referensi resmi)

---

## ⚠️ ATURAN MUTLAK UNTUK AI (V2)

1. BACA MASTER_CONTEXT.md DAN FILE INI SEBELUM MENULIS SATU BARIS KODE PUN
2. V1 SUDAH LIVE — JANGAN PERNAH hapus atau ubah logika bisnis fitur V1 yang sudah berjalan
3. Semua perubahan V2 adalah ADDITIVE (tambah) atau PATCH (perbaikan bug spesifik)
4. JANGAN tambah npm dependency baru tanpa konfirmasi eksplisit user
5. JANGAN buat tabel database baru yang tidak ada di MASTER_CONTEXT.md Section 5
6. SELALU TypeScript strict — tidak ada `any`
7. SELALU gunakan pola komponen yang sudah ada di /components/ui/ dan /components/shared/
8. SETIAP response: sebutkan file yang akan dibuat/diubah SEBELUM menulis kode
9. Saat mengerjakan fitur baru: JANGAN sentuh file yang tidak berkaitan
10. WAJIB: loading skeleton, empty state, dark mode support di setiap komponen baru
11. WAJIB: semua teks UI dalam Bahasa Indonesia
12. JANGAN mengubah design system kecuali warna primary/secondary sesuai V2 spec
13. Kamu wajib memberikan penjelasan, balasan, komentar kode, dan seluruh string UI (label, placeholder, error message) dalam Bahasa Indonesia sesuai aturan proyek.

---

## 1. TECH STACK (TIDAK BERUBAH DARI V1)

Next.js 14+ App Router | TypeScript 5+ | Supabase | Tailwind CSS |
Radix UI | React Hook Form + Zod | TanStack Query + Table |
Recharts | lucide-react | next-themes | date-fns + react-day-picker | cmdk

Dependencies: SAMA dengan V1, tidak ada yang baru kecuali yang disebutkan eksplisit.

---

## 2. FASE IMPLEMENTASI V2

### Status Progress (Juli 2026)

| Fase | Status | Catatan |
|------|--------|---------|
| A Foundation | ⚠️ ~85% | CSS variables ✅; chart Recharts & teks "SQA" di beberapa file masih partial |
| B Quick Wins | ✅ ~95% | Sidebar collapsible ✅; minRole filter ✅ |
| C Admin Extended | ⚠️ ~90% | **C5 UI antrian belum ada**; C6 alur prestasi→kedisiplinan ✅ |
| D Signup | ✅ 100% | |
| E Mutabaah | ✅ ~95% | Target pakai `poin_target` kegiatan, bukan CRUD `target_mutabaah` |
| F Diknas | ✅ ~100% | + laporan bulanan, tipe nilai, data kelas (extra) |
| G Orang Tua | ✅ ~95% | + laporan bulanan orang tua |
| H Deploy | — | Tidak diverifikasi di audit dokumentasi |

### FASE A — Foundation (Harus dikerjakan PERTAMA, tidak ada dependency fitur)
- A1: Jalankan SUPABASE_MIGRATIONS.sql di Supabase — ✅
- A2: Update warna (primary #1e5d7e, secondary #437793) di globals.css + tailwind.config.ts — ⚠️ **PARTIAL** (chart masih `#2D7A4F`/`#C9A84C` di dashboard, kedisiplinan, prestasi, superadmin)
- A3: Rename "SQA Platform"→"AMANAH Platform" di seluruh codebase — ⚠️ **PARTIAL** (masih ada di landing hero/how-it-works, superadmin settings default)
- A4: Fix bug dark mode (globals.css + komponen yang hardcode warna) — ✅ sebagian besar
- A5: Fix bug cetak laporan (CSS @media print — sembunyikan sidebar/header) — ✅
- A6: Fix icon browser (favicon dari public/icon.png) — ✅
- A7: Fix landing page responsif mobile — ✅
- A8: Fix bug password show/hide di account page — ✅
- A9: Fix filter status "Sudah Diproses" di rekap poin & dashboard kedisiplinan — ✅
- A10: Update types.ts dengan semua tipe baru — ✅

### FASE B — Quick Wins & Identity
- B1: Landing page — tambah Section About (deskripsi AMANAH) — ✅
- B2: Landing page — tambah CTA button InspiraLabs — ✅
- B3: Link InspiraLabs → https://inspiralabs.id/ dan nama creator → WhatsApp — ✅
- B4: Sidebar collapsible (hide/unhide toggle) — ✅ (`amanah-sidebar-collapsed`)
- B5: Menu About di dashboard (per role) — ✅
- B6: Update Data Siswa — full edit + alumni tab + filter — ✅
- B7: Prestasi — tambah prestasi guru (tipe='guru') — ✅
- B8: Role user: sembunyikan menu master kedisiplinan & prestasi — ✅ (via minRole)

### FASE C — Admin Extended
- C1: CRUD Mata Pelajaran (/admin/mapel) — ✅
- C2: CRUD Guru (/admin/guru) — ✅ (lihat detail expanded di bawah)
- C3: CRUD Orang Tua (/admin/orangtua) — ✅
- C4: Manajemen Semester & Tahun Pelajaran (/admin/semester) — ✅ (single-active global)
- C5: Dashboard Kedisiplinan — tabel antrian persetujuan poin prestasi — ❌ **UI BELUM** (query layer ✅)
- C6: Alur otomatis prestasi → kedisiplinan (trigger di createPrestasi) — ✅

### FASE D — Signup Dua Jalur
- D1: Halaman pilih tipe signup (/signup) — ✅
- D2: Form signup guru/musyrif (/signup/guru) — dengan mapel & kamar — ✅
- D3: Form signup orang tua (/signup/orangtua) — dengan pencarian anak — ✅

### FASE E — Mutabaah (Kepesantrenan)
- E1: Query functions (src/lib/queries/mutabaah.ts) — ✅ (+ getMutabaahDashboardData gabungan)
- E2: CRUD Kamar (terintegrasi di admin) — ✅ `/admin/kamar`
- E3: CRUD Kegiatan & Sub Kegiatan — ✅
- E4: Input Harian — checklist grid per kamar — ✅
- E5: Rekap Kegiatan — filter kamar, search, tanggal range — ✅
- E6: Target & Nilai A-E — ✅ (target dari poin_target, bukan CRUD target_mutabaah)
- E7: Dashboard grafik mutabaah — ✅
- E8: Cetak Laporan Mutabaah — ✅

### FASE F — Diknas (Akademik)
- F1: Query functions (src/lib/queries/diknas.ts) — ✅
- F2: CRUD Presensi — bulk input per tanggal/kelas/mapel — ✅ (+ GuruMapelGate)
- F3: CRUD Nilai Harian — formatif/sumatif + remedial + bank soal — ✅ (+ GuruMapelGate)
- F4: CRUD Nilai UAS — + remedial — ✅ (+ GuruMapelGate)
- F5: Bank Soal CRUD — ✅ (+ GuruMapelGate)
- F6: Catatan Kelakuan CRUD — ✅ (tanpa GuruMapelGate)
- F7: Rekap Nilai Rapor — formula tiga komponen — ✅
- F8: Sistem Approval massal (guru approve → tampil di orangtua) — ✅
- F9: Dashboard grafik diknas — ✅
- F10: Manajemen Semester lanjutan — ✅ (di /admin/semester, bukan /diknas/semester)
- **F-EXTRA:** Laporan Hasil Belajar Bulanan (/diknas/laporan-bulanan) — ✅
- **F-EXTRA:** Master Tipe Nilai (/admin/tipe-nilai) — ✅
- **F-EXTRA:** Master Data Kelas (/admin/mapel/kelas) — ✅

### FASE G — Role Orang Tua
- G1: Protected route group /orangtua — ✅
- G2: Dashboard orang tua — ✅
- G3: Pantau Mutabaah anak — ✅
- G4: Pantau Diknas anak (nilai yang sudah approved) — ✅
- G5: Pantau Kedisiplinan anak — ✅
- G6: Pantau Prestasi anak — ✅
- G7: Filter tanggal + cetak per menu — ✅ sebagian besar
- **G-EXTRA:** Laporan Hasil Belajar Bulanan (/orangtua/laporan-bulanan) — ✅

### FASE H — Deploy V2
- H1: Build check + TypeScript error 0
- H2: Push ke GitHub
- H3: Deploy ke Vercel (environment variables sama)

---

## 3. DETAIL FITUR PER FASE

### FASE A — BUG FIXES

#### A2: Ganti Warna
File: `src/app/globals.css` dan `tailwind.config.ts`
- `--primary: #1e5d7e` (ganti dari #2D7A4F) — ✅ di CSS variables
- `--primary-hover: #174d6a`
- `--primary-light: #e8f4fa`
- `--secondary: #437793` (ganti dari #C9A84C)
- `--secondary-hover: #366180`
- `--secondary-light: #eaf3f8`
- Di tailwind.config.ts: ganti hex di objek colors.primary dan colors.secondary — ✅
- Recharts fill yang hardcode hex lama juga diganti — ⚠️ **BELUM SEMUA** (cek: `dashboard/page.tsx`, `kedisiplinan/page.tsx`, `prestasi/page.tsx`, `superadmin/*`)
- Gunakan `var(--primary)` atau `#1e5d7e` — jangan `#2D7A4F` / `#C9A84C`

#### A4: Fix Dark Mode
Masalah: beberapa komponen masih pakai class Tailwind hard-coded `bg-white`, `text-black`,
`bg-gray-100` dll yang tidak responsive terhadap dark mode.
Solusi: cari-ganti semua ke CSS variable via custom Tailwind colors:
- `bg-white` → `bg-surface`
- `bg-gray-50/100` → `bg-surface-2`
- `text-black` / `text-gray-900` → `text-text-primary`
- `text-gray-500/600` → `text-text-secondary`
- `border-gray-200` → `border-border`
File target: sidebar.tsx, header.tsx, semua halaman di (app)/

Khusus footer dashboard & rekap poin → cari class yang pakai bg hardcode, ganti.

#### A5: Fix Cetak Laporan
Masalah: saat print, sidebar dan header ikut tercetak.
Solusi di globals.css `@media print`:
```css
@media print {
  .no-print { display: none !important; }
  nav, aside, header, [data-sidebar], .sidebar-wrapper { display: none !important; }
  main { margin: 0 !important; padding: 0 !important; width: 100% !important; }
  .print-header { display: block !important; }
  body { background: white !important; color: black !important; }
  table, th, td { border: 1px solid #333 !important; }
}
```
Tambahkan class `no-print` ke: Sidebar, Header, filter bar, semua tombol aksi.
Tambahkan class `print-header` ke: div header formal laporan (sudah hidden di screen).

#### A6: Favicon
Buat/letakkan file `public/icon.png` (bisa logo AMANAH 32x32 atau 64x64).
Di `src/app/layout.tsx` metadata:
```typescript
icons: {
  icon: '/icon.png',
  apple: '/icon.png',
}
```

#### A9: Fix Filter Status "Sudah Diproses"
Files yang harus diupdate:
1. `src/lib/queries/rekap-poin.ts` — getRekapPoin(), getTop10Leaderboard(), getDetailSiswa()
   Tambahkan `.eq('status', 'Sudah Diproses')` di semua query kedisiplinan
2. `src/lib/queries/dashboard.ts` — getKedisiplinanStatusCount(), getKedisiplinanTopKategori()
   Filter yang menghitung poin harus exclude 'Belum Diproses' dan 'Pending'
3. `src/lib/queries/kedisiplinan.ts` — getKedisiplinanDashboard()
   Stats yang represent poin harus filter status='Sudah Diproses'

PENTING: Untuk tampilan daftar/tabel kedisiplinan (bukan perhitungan poin),
TIDAK perlu filter status — semua record tetap ditampilkan.
Filter status hanya untuk kalkulasi poin.

#### A7: Fix Landing Page Responsif
Masalah: teks hero tabrakan dengan screenshot di mobile.
Solusi di hero-section.tsx:
- Screenshot section: `flex-col` di mobile, `grid-cols-2` di md+
- Teks hero: pastikan `z-10 relative` dan screenshot `mt-8 md:mt-16`
- Container screenshot: `w-full overflow-hidden` dengan max-width
- Cek semua section: features, how-it-works, stats, CTA — pastikan responsive

### FASE B — QUICK WINS

#### B4: Sidebar Collapsible
File: `src/components/layout/sidebar.tsx`
- Tambah state `isCollapsed: boolean` (default false)
- Tambah button toggle (icon PanelLeftClose / PanelLeftOpen dari lucide-react)
- Collapsed state: width w-14 (hanya icon, tanpa label)
- Expanded state: width w-60 (icon + label seperti sekarang)
- Transisi: CSS transition-width duration-200
- Simpan preferensi ke localStorage (`amanah-sidebar-collapsed`)
- Header component: sesuaikan margin-left saat sidebar collapsed

#### B5: Menu About
File baru: `src/app/(app)/about/page.tsx`
- Konten: deskripsi AMANAH (dari poin 21 spec)
- Panduan penggunaan: conditional render berdasarkan role
- Tambah di header dropdown avatar: link "Tentang" dengan icon Info dibawah "Akun Saya"

#### B6: Update Data Siswa
File: `src/app/(app)/students/page.tsx` + `src/lib/queries/students.ts`
- Tab baru: "Alumni" → query WHERE is_alumni=true
- Tab SD/SMP/SMA: tambah filter `AND is_alumni=false`
- Dialog Edit: tampilkan SEMUA field (nama, kelas, jenis_kelamin, kamar, nomor_induk)
- Bulk edit: pilih banyak siswa → buka dialog edit massal
- Tambah aksi: "Jadikan Alumni" → UPDATE is_alumni=true, konfirmasi dialog

#### B7: Prestasi Guru
File: `src/app/(app)/prestasi/data/page.tsx` + `src/lib/queries/prestasi.ts`
- Tambah toggle di atas tabel: "Siswa" | "Guru"
- Form prestasi guru: ganti field "Nama Siswa" → "Nama Guru" (combobox dari profiles WHERE role='user')
- Field yang sama: event, tempat, waktu, juara, jenis_juara, bidang, kategori, tingkat
- Kolom tabel: tambahkan kolom "Tipe" (badge Siswa/Guru)
- Query: tambah filter `tipe` (default 'siswa')

#### B8: Restrict Role User
File: `src/components/layout/sidebar.tsx`
- Role 'user': sembunyikan menu master (Kategori, Divisi, Pasal, Tindakan di kedisiplinan sub-menu, Event/Juara/Bidang/Kategori di prestasi sub-menu)
- Role 'user': di kedisiplinan hanya tampilkan "Dashboard", "Data", "Rekap Poin" dan "Cetak Laporan"
- Role 'user': di prestasi hanya tampilkan "Dashboard", "Data" dan "Cetak Laporan"
- Logika: `profile.role === 'user'` → filter menu items

### FASE C — ADMIN EXTENDED

#### C1: CRUD Mata Pelajaran (/admin/mapel)
Tabel kolom: No | Nama Mapel | Kategori | Unit | Aksi
Filter awal: SD | SMP | SMA
Input form: Nama Mapel (text), Kategori (text: "DIKNAS SMA", "KEPESANTRENAN SMP" dll), Unit (select)
Pagination: 10,20,30,50 default 10

#### C2: CRUD Guru (/admin/guru)
Tabel kolom: No | Nama | NIP | Tipe | Mapel/Kamar | Email | Status Akun | Aksi
Status Akun: Badge "Punya Akun" (hijau) / "Belum Ada Akun" (abu-abu)
Aksi per row: Edit, Hapus, "Buat Akun" (jika belum ada profile_id → arahkan ke Kelola User)

**Form profil operasional (TANPA buat akun auth di form ini):**
- Field umum: Nama, NIP, JK, Email, No HP
- Tipe (guru / musyrif / guru_musyrif) — UI kondisional:
  - **guru:** Unit Mengajar (SD/SMP/SMA checkbox) + Mapel (multi-select)
  - **musyrif:** Unit Binaan (SD/SMP/SMA checkbox) + Kamar (multi-select, di-fetch setelah unit dipilih via `getKamarOptions`)
  - **guru_musyrif:** ketiganya (unit mengajar + mapel + unit binaan + kamar)
- Validasi Zod: musyrif wajib minimal 1 unit binaan + 1 kamar
- Simpan ke tabel `guru`: `mapel_ids`, `kamar_ids`, `unit[]`, `tipe`
- Jika `profile_id` ada: sync juga ke `profiles` via `normalizeGuruRelations()`
- DB: kolom `guru.kamar_ids uuid[]` — jalankan migrasi jika belum ada

#### C3: CRUD Orang Tua (/admin/orangtua)
Tabel kolom: No | Nama | Pekerjaan | Anak | Email | Status Akun | Aksi
"Anak": relasi ke orangtua_siswa → tampilkan nama anak(s)
Form: Nama, Pekerjaan, Email, No HP, Anak (combobox search dari students)

#### C4: Semester & Tahun Pelajaran (/admin/semester)
Dua section:
1. Tahun Pelajaran: CRUD (nama, tahun_mulai, tahun_selesai, toggle is_aktif)
2. Semester: CRUD per tahun pelajaran (nomor, tanggal_mulai, tanggal_selesai, toggle is_aktif)
Info: semester aktif ditampilkan sebagai badge "AKTIF"
Peringatan: hanya boleh 1 tahun pelajaran aktif dan 1 semester aktif **secara global** dalam satu waktu
Implementasi: `setActiveSemester` / `setActiveTahunPelajaran` reset semua `is_aktif=true` dulu, baru set target
Guard UUID: jangan panggil mutasi jika id kosong; jangan gunakan `.neq('id', '')` pada kolom UUID
Invalidate cache: `active-semester`, `active-semester-mutabaah`, `active-semester-diknas` setelah aktivasi

#### C5: Tabel Antrian Persetujuan Poin
**Status: ❌ UI BELUM DIIMPLEMENTASI** (query layer sudah ada di `kedisiplinan.ts`)
File: `src/app/(app)/kedisiplinan/page.tsx`
Tambahkan di ATAS grafik tren:
- Card "Antrian Persetujuan Poin Prestasi"
- Tabel kolom: Tanggal | Nama Siswa | Kelas | Unit | Prestasi (nama event+juara) | Poin | Aksi
- Data: kedisiplinan WHERE sumber='prestasi' AND status='Belum Diproses'
- Aksi: "Setujui" (UPDATE status='Sudah Diproses') | "Tolak" (DELETE)
- Bulk action: "Setujui Semua" yang terpilih
- Badge counter di judul: "X antrian"

#### C6: Alur Otomatis Prestasi → Kedisiplinan
**Status: ✅ SELESAI** di `src/lib/queries/prestasi.ts` — fungsi `createPrestasi()`
File: `src/lib/queries/prestasi.ts` — update fungsi createPrestasi()
Setelah INSERT prestasi berhasil:
1. Cari kategori_disiplin WHERE nama_kategori='Prestasi' → dapat kategori_id
2. Cari pasal berdasarkan tingkat_kejuaraan + nama_juara:
   Buat fungsi `findPasalPrestasi(tingkat: string, namaJuara: string)`:
   - Query: SELECT id FROM pasal WHERE nama_pasal ILIKE '%{tingkat}%' AND nama_pasal ILIKE '%{namaJuara}%' LIMIT 1
3. INSERT kedisiplinan: { tanggal: prestasi.waktu, siswa_id, kategori_id, pasal_id, diberikan_oleh, sumber:'prestasi', prestasi_id, status:'Belum Diproses' }
4. UPDATE prestasi SET sudah_dilempar_kedisiplinan=true
Jika pasal tidak ditemukan: insert kedisiplinan tanpa pasal_id, tampilkan info di antrian "pasal belum tersedia"

---

## 4. DETAIL FITUR MUTABAAH (FASE E)

### E4: Input Harian — Checklist Grid
Route: /mutabaah/input
Layout: Pilih Tanggal (DatePicker) + Pilih Kamar (Select dari kamar WHERE musyrif_id=profile.id)
Jika tanggal ada di hari_libur: tampilkan banner libur + tombol "Tandai Semua Libur"
Grid per siswa (rows) × per kegiatan/sub (columns):
- Header kolom: nama kegiatan (jika ada sub: nama_kegiatan / nama_sub)
- Setiap cell: jika sudah ada data = tampilkan badge status, klik untuk ubah
- Jika belum ada = radio/select status (Hadir defaultnya, bisa ganti)
- Bulk: "Hadir Semua" button per kegiatan column
Submit: upsert semua mutabaah (ON CONFLICT UPDATE)

### E6: Target & Nilai A-E
Route: /mutabaah/target
Filter: Siswa individual ATAU per kamar + filter semester
Tabel per siswa: baris = kegiatan/sub_kegiatan
Kolom: Nama Kegiatan | Total Hadir | Target | Progress Bar | Persentase | Nilai

**Implementasi aktual (bukan CRUD tabel `target_mutabaah`):**
- Target diambil dari `kegiatan.poin_target` / `sub_kegiatan.poin_target`
- Fallback default: 30 jika `poin_target` null
- Tabel `target_mutabaah` ada di schema tapi belum dipakai untuk UI admin CRUD

Progress bar: width = (hadir/target)*100, warna sesuai grade
Grade: A≥90%, B≥75%, C≥60%, D≥40%, E<40%
Color: A=hijau, B=biru, C=kuning, D=oranye, E=merah

### E7: Dashboard Mutabaah — Optimasi Performa
**Status: ✅ SELESAI**
- Satu fungsi gabungan: `getMutabaahDashboardData()` di `mutabaah.ts`
- Memanggil `resolveSiswaIds` sekali, lalu `Promise.all` untuk stat/chart
- Halaman `/mutabaah` memakai satu `useQuery` (bukan 3 query terpisah)
- Global defaults React Query di `query-provider.tsx`

---

## 5. DETAIL FITUR DIKNAS (FASE F)

### F2: CRUD Presensi
Route: /diknas/presensi
**GuruMapelGate:** guru hanya bisa input/update mapel yang ada di `profile.mapel_ids` (komponen `guru-mapel-gate.tsx`)
Layout: Filter unit (SD/SMP/SMA tabs seperti Kedisiplinan→Data)
Mode input: "Per Tanggal" (pilih tanggal → muncul list semua siswa kelas+mapel → bulk checkbox)
Kolom tabel: No | Nama Siswa | Kelas | Mata Pelajaran | Tanggal | Status | Keterangan | Aksi
Form tambah: Tanggal (DatePicker), Siswa (combobox), Mapel (auto dari profile.mapel_ids atau pilih), Status, Keterangan
Bulk input: pilih tanggal, pilih kelas, pilih mapel → tampil semua siswa → set status per siswa

### F7: Rekap Nilai Rapor
Route: /diknas/rekap-nilai
Filter: Unit, Kelas, Semester, Mata Pelajaran, Nama Siswa (search)
Tabel kolom: No | Nama | Kelas | Avg Formatif | Avg Sumatif | Nilai UAS | Nilai Rapor | Aksi
Nilai Rapor = AVERAGE(avg_formatif, avg_sumatif, nilai_uas) — dihitung JS
Aksi: "Detail" → Sheet slide-over dengan breakdown semua tugas dan nilai

### F8: Approval Massal
Di halaman nilai-harian dan nilai-uas:
- Checkbox multi-select + button "Approve Terpilih" (hanya muncul jika is_approved=false)
- Konfirmasi: "Nilai yang diapprove akan tampil di dashboard orang tua"
- UPDATE is_approved=true, approved_at=now(), approved_by=profile.id

---

## 6. DETAIL FITUR ORANG TUA (FASE G)

### Dashboard Orang Tua
- Jika orangtua punya >1 anak: tambah selector anak di atas
- Stat cards: Kehadiran bulan ini, Rata-rata nilai, Total prestasi, Status mutabaah
- Recent activity dari semua modul

### G3: Pantau Mutabaah
- Tabel sama dengan cetak laporan mutabaah (E8) tapi read-only
- Filter: tanggal range + kegiatan
- Grafik: kehadiran per kegiatan (bar chart)
- Cetak: tombol print

### G4: Pantau Diknas (PENTING: hanya approved)
- Presensi: tabel + grafik per mapel
- Nilai harian: tabel WHERE is_approved=true
- Nilai UAS: tabel WHERE is_approved=true
- Catatan kelakuan: tabel all
- Rekap nilai rapor: kalkulasi sama dengan guru view

---

## 7. HALAMAN ABOUT (/about)

**Implementasi saat ini:** satu halaman scroll (bukan Tabs terpisah "Tentang" vs "Panduan").

Konten:
- Hero kecil: logo AMANAH + tagline
- Deskripsi lengkap aplikasi (teks dari poin 21 spec)
- Panduan penggunaan (conditional per role, dalam satu halaman):
  - user/guru: panduan input kedisiplinan, prestasi, nilai, presensi
  - musyrif: panduan input mutabaah
  - admin: panduan kelola user, approve akun
  - orangtua: panduan memantau anak
  - superadmin: panduan sistem
- Kontak: InspiraLabs (link) + Unggul Sulaiman S.Kom (WhatsApp)

> Catatan: panduan menyebut antrian poin prestasi di dashboard kedisiplinan — fitur UI belum ada (C5).

---

## 8. LANDING PAGE V2 ADDITIONS

### Section About (sebelum Features)
- H2: "Mengapa AMANAH?"
- Teks deskripsi (dari poin 21, dipersingkat 3-4 paragraf)
- 3 pilar card: Guru | Musyrif | Orang Tua (dengan icon dan deskripsi singkat)

### CTA Button InspiraLabs
Di CTA section (bawah landing page):
- Button existing: "Daftar Sekarang" → /signup
- Button baru: "Kunjungi InspiraLabs" → https://inspiralabs.id/ (target="_blank")
  Style: warna secondary (#437793), outline variant, berbeda dari CTA utama
  Icon: ExternalLink dari lucide-react

---

## 9. CATATAN PENTING UNTUK AI

1. Saat mengerjakan FASE A (bug fix), jangan ubah logika apapun selain yang disebutkan
2. Urutan wajib: A → B → C → D → E → F → G → H
3. Setiap fase selesai: jalankan `npx tsc --noEmit` pastikan 0 error sebelum lanjut
4. Untuk tabel yang perlu relasi baru: cek MASTER_CONTEXT.md Section 5 dulu
5. Semua query functions BARU di lib/queries/: gunakan pola yang SAMA dengan queries yang sudah ada
6. Jangan buat ulang komponen yang sudah ada — extend atau reuse
7. Jika ada prompt yang kurang jelas karena prompt tidak sesuai dengan MASTER_CONTEXT.md atau PRD.md maka konfirmasi untuk penyempurnaan prompt ketika eksekusi
8. **React Query:** ikuti global defaults di `query-provider.tsx`; gabungkan query dashboard yang share resolver; gunakan `EMPTY_ARRAY` stabil di luar komponen
9. **Supabase UUID:** jangan filter UUID dengan string kosong; guard id sebelum mutasi; single-active `is_aktif` bersifat global
10. **GuruMapelGate** wajib di presensi, nilai-harian, nilai-uas, bank-soal — belum di catatan kelakuan
11. File PRD resmi: `PRD.md` (bukan `PRD_V2.md`)

---

## 10. DEPLOYMENT V2

Sama dengan V1 tapi ada tambahan:
1. `npm run build` — pastikan 0 error
2. Push ke branch baru `git checkout -b v2-release`
3. Push ke GitHub
4. Vercel: deploy dari branch v2-release ATAU merge ke main
5. Environment variables: tidak ada yang berubah dari V1
6. Setelah deploy: test semua fitur V1 masih jalan, baru test fitur V2