# PRD — SQA Platform (Sekolah Quran Asy Syahid)
# Version: 1.0.0 | Last Updated: 2026
# STATUS: SUMBER KEBENARAN TUNGGAL — SELALU BACA INI SEBELUM MENULIS KODE APAPUN

---

## ⚠️ ATURAN MUTLAK UNTUK AI

1. BACA SELURUH FILE INI SEBELUM MENULIS SATU BARIS KODE PUN
2. JANGAN pernah mengubah fitur yang sudah dibuat tanpa instruksi eksplisit dari user
3. JANGAN pernah menambah dependency baru tanpa konfirmasi user
4. JANGAN pernah membuat tabel database baru — gunakan schema yang sudah ada
5. JANGAN pernah mengubah nama kolom atau tipe data di database
6. JANGAN pernah menghapus komponen yang sudah dibuat
7. JANGAN pernah mengubah design system (warna, font, spacing) yang sudah ditetapkan
8. JANGAN pernah membuat file di luar struktur folder yang sudah ditetapkan
9. SELALU gunakan TypeScript strict — tidak ada penggunaan `any`
10. SELALU ikuti pola yang sudah ada di codebase untuk konsistensi
11. JIKA ragu, TANYA user — jangan berasumsi dan langsung implement
12. SETIAP response harus menyebutkan file apa saja yang akan dibuat/diubah SEBELUM menulis kode

---

## 1. IDENTITAS PROYEK

| Field | Value |
|---|---|
| Nama Aplikasi | SQA Platform |
| Kepanjangan | Sekolah Quran Asy Syahid Platform |
| Dibuat Oleh | Unggul Sulaiman, S.Kom (Guru Informatika) |
| Tahun | 2026 |
| Institusi | Sekolah Quran Asy Syahid |
| Tagline | Platform Digital Yang Membantu Guru Di Lingkungan Sekolah Quran Asy Syahid |
| Footer | ©2026 InspiraLabs · Unggul Sulaiman, S.Kom |

---

## 2. TECH STACK (TIDAK BOLEH DIUBAH)

| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js App Router | 14+ |
| Language | TypeScript | 5+ strict mode |
| Database | Supabase (PostgreSQL) | Latest |
| Auth | Supabase Auth | Latest |
| Styling | Tailwind CSS | 3+ |
| UI Primitives | Radix UI | Sesuai yang terinstall |
| Form | React Hook Form + Zod | Latest |
| Data Fetching | @tanstack/react-query | Latest |
| Table | @tanstack/react-table | Latest |
| Charts | Recharts | Latest |
| Icons | lucide-react | Latest |
| Theme | next-themes | Latest |
| Date | date-fns + react-day-picker | Latest |
| Autocomplete | cmdk | Latest |
| Deploy | Vercel | Latest |

### Dependencies yang Sudah Terinstall (JANGAN TAMBAH LAGI):
```
@supabase/supabase-js @supabase/ssr
@tanstack/react-query @tanstack/react-table
react-hook-form @hookform/resolvers zod
recharts lucide-react next-themes
date-fns react-day-picker cmdk
@radix-ui/react-dialog @radix-ui/react-dropdown-menu
@radix-ui/react-select @radix-ui/react-tabs
@radix-ui/react-toast @radix-ui/react-avatar
@radix-ui/react-popover @radix-ui/react-radio-group
@radix-ui/react-checkbox @radix-ui/react-switch
@radix-ui/react-label @radix-ui/react-separator @radix-ui/react-slot
class-variance-authority clsx tailwind-merge tailwindcss-animate
```

---

## 3. ENVIRONMENT VARIABLES

```env
NEXT_PUBLIC_SUPABASE_URL=https://ohoueqisnrrzrbcejicw.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_5iPapNvTJD3UrUKa19w1kA_IuO9v4Tr
```
JANGAN hardcode nilai ini di kode. Selalu gunakan `process.env.NEXT_PUBLIC_SUPABASE_URL` dll.

---

## 4. DESIGN SYSTEM (TIDAK BOLEH DIUBAH)

### 4.1 Warna
```css
/* Light Mode */
--background: #F8F8F6          /* off-white soft, bukan putih terang */
--surface: #FFFFFF              /* card/panel background */
--surface-2: #F2F2EF            /* secondary surface */
--border: #E5E5E0               /* subtle border */
--text-primary: #1C1C1A         /* teks utama */
--text-secondary: #6B6B68       /* teks sekunder/muted */
--text-tertiary: #9A9A97        /* teks tersier/placeholder */

/* Dark Mode */
--background: #1A1A1A           /* soft dark, bukan hitam pekat */
--surface: #242424              /* card/panel background */
--surface-2: #2C2C2C            /* secondary surface */
--border: #2E2E2E               /* subtle border */
--text-primary: #F0F0EE         /* teks utama */
--text-secondary: #9A9A97       /* teks sekunder/muted */
--text-tertiary: #6B6B68        /* teks tersier/placeholder */

/* Accent — SAMA untuk light dan dark */
--primary: #2D7A4F              /* hijau utama */
--primary-hover: #246040        /* hijau hover */
--primary-light: #E8F5EE        /* hijau muted/bg */
--primary-foreground: #FFFFFF   /* teks di atas primary */
--secondary: #C9A84C            /* emas utama */
--secondary-hover: #B8963E      /* emas hover */
--secondary-light: #FBF5E6      /* emas muted/bg */
--secondary-foreground: #FFFFFF /* teks di atas secondary */

/* Status Colors */
--status-red: #DC2626           /* error / Belum Diproses */
--status-red-bg: #FEF2F2
--status-yellow: #D97706        /* warning / Pending */
--status-yellow-bg: #FFFBEB
--status-green: #16A34A         /* success / Sudah Diproses */
--status-green-bg: #F0FDF4
```

### 4.2 Typography
- Font Family: `Inter` (Google Fonts)
- Font Sizes: Tailwind default scale (text-xs, text-sm, text-base, text-lg, text-xl, text-2xl, text-3xl)
- Font Weights: 400 (normal), 500 (medium), 600 (semibold), 700 (bold)

### 4.3 Spacing & Border Radius
- Menggunakan Tailwind default scale
- Border radius komponen: `rounded-lg` (8px) untuk cards/dialogs, `rounded-md` (6px) untuk inputs/buttons, `rounded-full` untuk badges/avatars

### 4.4 Shadows
- Card shadow light: `shadow-sm`
- Modal shadow: `shadow-lg`
- Dropdown shadow: `shadow-md`

### 4.5 Style Direction
- Clean, Minimalist, Modern, Elegant
- Tidak ada gradien berlebihan
- Tidak ada animasi berlebihan (hanya transisi subtle)
- Whitespace yang cukup (padding generous)
- Konsisten di seluruh halaman

---

## 5. DATABASE SCHEMA (READ-ONLY — JANGAN BUAT TABEL BARU)

### 5.1 Tabel profiles
```sql
id: uuid PK DEFAULT uuid_generate_v4()
user_id: uuid UNIQUE FK → auth.users(id)
nama_lengkap: text NOT NULL
guru_mapel: text
username: text NOT NULL UNIQUE
role: text DEFAULT 'user' CHECK IN ('user', 'admin', 'superadmin')
is_approved: boolean DEFAULT false
avatar_url: text
email: text
created_at: timestamptz DEFAULT now()
updated_at: timestamptz DEFAULT now()
```

### 5.2 Tabel students
```sql
id: uuid PK DEFAULT uuid_generate_v4()
nama: text NOT NULL
kelas: text NOT NULL
jenis_kelamin: text CHECK IN ('L', 'P')
unit: text CHECK IN ('SD', 'SMP', 'SMA')
created_at: timestamptz DEFAULT now()
```

### 5.3 Tabel kategori_disiplin
```sql
id: uuid PK DEFAULT uuid_generate_v4()
nama_kategori: text NOT NULL
```

### 5.4 Tabel divisi
```sql
id: uuid PK DEFAULT uuid_generate_v4()
nama_divisi: text NOT NULL
unit: text CHECK IN ('SD', 'SMP', 'SMA')
```

### 5.5 Tabel pasal
```sql
id: uuid PK DEFAULT uuid_generate_v4()
nama_pasal: text NOT NULL
kategori_id: uuid FK → kategori_disiplin(id)
poin: integer DEFAULT 0
```

### 5.6 Tabel tindakan
```sql
id: uuid PK DEFAULT uuid_generate_v4()
nama_tindakan: text NOT NULL
kategori_id: uuid FK → kategori_disiplin(id)
```

### 5.7 Tabel kedisiplinan
```sql
id: uuid PK DEFAULT uuid_generate_v4()
tanggal: date NOT NULL
diberikan_oleh: text NOT NULL
siswa_id: uuid FK → students(id)
kategori_id: uuid FK → kategori_disiplin(id)
divisi_id: uuid FK → divisi(id)
pasal_id: uuid FK → pasal(id)
tindakan_id: uuid FK → tindakan(id)
status: text DEFAULT 'Belum Diproses' CHECK IN ('Belum Diproses', 'Pending', 'Sudah Diproses')
created_at: timestamptz DEFAULT now()
```

### 5.8 Tabel kategori_prestasi
```sql
id: uuid PK DEFAULT uuid_generate_v4()
nama_kategori: text NOT NULL
```

### 5.9 Tabel event
```sql
id: uuid PK DEFAULT uuid_generate_v4()
nama_event: text NOT NULL
penyelenggara: text
```

### 5.10 Tabel juara
```sql
id: uuid PK DEFAULT uuid_generate_v4()
nama_juara: text NOT NULL
```

### 5.11 Tabel bidang
```sql
id: uuid PK DEFAULT uuid_generate_v4()
nama_bidang: text NOT NULL
```

### 5.12 Tabel prestasi
```sql
id: uuid PK DEFAULT uuid_generate_v4()
unit: text CHECK IN ('SD', 'SMP', 'SMA')
siswa_id: uuid FK → students(id)
event_id: uuid FK → event(id)
tempat: text CHECK IN ('Offline', 'Online')
waktu: date
juara_id: uuid FK → juara(id)
jenis_juara: text CHECK IN ('Individu', 'Kelompok')
bidang_id: uuid FK → bidang(id)
kategori_id: uuid FK → kategori_prestasi(id)
tingkat_kejuaraan: text
created_at: timestamptz DEFAULT now()
```

### 5.13 Tabel audit_log
```sql
id: uuid PK DEFAULT uuid_generate_v4()
user_id: uuid FK → auth.users(id)
action: text          -- 'CREATE' | 'UPDATE' | 'DELETE' | 'APPROVE_USER' | 'CHANGE_ROLE' | 'LOGIN' | 'LOGOUT'
table_name: text
record_id: uuid
old_data: jsonb
new_data: jsonb
created_at: timestamptz DEFAULT now()
```

### 5.14 Tabel announcements
```sql
id: uuid PK DEFAULT gen_random_uuid()
title: text NOT NULL
content: text NOT NULL
created_at: timestamptz DEFAULT now()
```
Catatan: tabel announcements juga digunakan untuk menyimpan SYSTEM_CONFIG dengan title='SYSTEM_CONFIG'

---

## 6. STRUKTUR FOLDER (WAJIB DIIKUTI)

```
sqa-platform/
├── src/
│   ├── app/
│   │   ├── (app)/                    ← protected routes group
│   │   │   ├── layout.tsx            ← app shell (sidebar + header)
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx
│   │   │   ├── students/
│   │   │   │   └── page.tsx
│   │   │   ├── kedisiplinan/
│   │   │   │   ├── page.tsx          ← dashboard kedisiplinan
│   │   │   │   ├── data/
│   │   │   │   │   └── page.tsx      ← CRUD kedisiplinan
│   │   │   │   ├── kategori/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── divisi/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── pasal/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── tindakan/
│   │   │   │   │   └── page.tsx
│   │   │   │   └── cetak/
│   │   │   │       └── page.tsx
│   │   │   ├── prestasi/
│   │   │   │   ├── page.tsx          ← dashboard prestasi
│   │   │   │   ├── data/
│   │   │   │   │   └── page.tsx      ← CRUD prestasi
│   │   │   │   ├── event/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── juara/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── bidang/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── kategori/
│   │   │   │   │   └── page.tsx
│   │   │   │   └── cetak/
│   │   │   │       └── page.tsx
│   │   │   ├── admin/
│   │   │   │   ├── overview/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── users/
│   │   │   │   │   └── page.tsx
│   │   │   │   └── announcements/
│   │   │   │       └── page.tsx
│   │   │   ├── superadmin/
│   │   │   │   ├── page.tsx          ← super dashboard
│   │   │   │   ├── roles/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── audit/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── analytics/
│   │   │   │   │   └── page.tsx
│   │   │   │   └── settings/
│   │   │   │       └── page.tsx
│   │   │   └── account/
│   │   │       └── page.tsx
│   │   ├── (auth)/                   ← public auth routes group
│   │   │   ├── login/
│   │   │   │   └── page.tsx
│   │   │   └── signup/
│   │   │       └── page.tsx
│   │   ├── layout.tsx                ← root layout
│   │   ├── page.tsx                  ← landing page
│   │   └── globals.css
│   ├── components/
│   │   ├── ui/                       ← base UI components (shadcn pattern)
│   │   │   ├── button.tsx
│   │   │   ├── input.tsx
│   │   │   ├── label.tsx
│   │   │   ├── card.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── select.tsx
│   │   │   ├── dropdown-menu.tsx
│   │   │   ├── tabs.tsx
│   │   │   ├── badge.tsx
│   │   │   ├── avatar.tsx
│   │   │   ├── separator.tsx
│   │   │   ├── switch.tsx
│   │   │   ├── checkbox.tsx
│   │   │   ├── radio-group.tsx
│   │   │   ├── popover.tsx
│   │   │   ├── toast.tsx
│   │   │   ├── use-toast.ts
│   │   │   ├── command.tsx
│   │   │   ├── table.tsx
│   │   │   ├── skeleton.tsx
│   │   │   └── calendar.tsx
│   │   ├── layout/                   ← layout komponen
│   │   │   ├── sidebar.tsx
│   │   │   ├── header.tsx
│   │   │   └── page-header.tsx
│   │   ├── landing/                  ← landing page komponen
│   │   │   ├── hero-section.tsx
│   │   │   ├── features-section.tsx
│   │   │   └── stats-section.tsx
│   │   ├── shared/                   ← komponen yang dipakai di banyak tempat
│   │   │   ├── data-table.tsx        ← reusable table dengan pagination+sort
│   │   │   ├── combobox.tsx          ← reusable autocomplete combobox
│   │   │   ├── date-picker.tsx       ← reusable date picker
│   │   │   ├── page-title.tsx
│   │   │   ├── stat-card.tsx
│   │   │   ├── confirm-dialog.tsx    ← reusable delete confirmation
│   │   │   ├── empty-state.tsx
│   │   │   └── loading-spinner.tsx
│   │   └── providers/
│   │       ├── theme-provider.tsx
│   │       ├── auth-provider.tsx
│   │       └── query-provider.tsx
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts             ← browser client
│   │   │   ├── server.ts             ← server client
│   │   │   └── types.ts              ← TypeScript types untuk semua tabel
│   │   ├── auth/
│   │   │   └── actions.ts            ← server actions: login, signup, logout
│   │   ├── audit/
│   │   │   └── log.ts                ← audit logging helper
│   │   ├── queries/
│   │   │   ├── dashboard.ts
│   │   │   ├── students.ts
│   │   │   ├── kedisiplinan.ts
│   │   │   ├── prestasi.ts
│   │   │   ├── admin.ts
│   │   │   ├── superadmin.ts
│   │   │   └── profile.ts
│   │   └── utils.ts                  ← cn() dan utility functions
│   ├── hooks/
│   │   ├── use-auth.ts
│   │   ├── use-debounce.ts
│   │   └── use-media-query.ts
│   └── middleware.ts
├── PRD.md                            ← FILE INI
├── .cursorrules                      ← rules untuk cursor AI
├── .env.local
├── .gitignore
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## 7. TYPESCRIPT TYPES (REFERENSI)

```typescript
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
```

---

## 8. AUTH FLOW (DETAIL)

### 8.1 Sign Up Flow
```
User isi form signup (nama_lengkap, guru_mapel, email, username, password)
  → Validasi Zod client-side
  → Server Action: signup()
    → supabase.auth.signUp({ email, password })
    → INSERT INTO profiles (user_id, nama_lengkap, guru_mapel, username, email, role='user', is_approved=false)
    → Return success message
  → UI tampilkan: "Akun berhasil dibuat. Menunggu persetujuan Admin."
  → User TIDAK bisa login sampai is_approved=true
```

### 8.2 Login Flow
```
User isi form login (username, password)
  → Server Action: login()
    → SELECT email FROM profiles WHERE username = ?
    → Jika tidak ketemu → error "Username tidak ditemukan"
    → supabase.auth.signInWithPassword({ email, password })
    → Jika auth error → error "Password salah"
    → SELECT is_approved FROM profiles WHERE user_id = auth.uid()
    → Jika is_approved = false → signOut() → error "Akun belum disetujui Admin"
    → Jika semua OK → redirect ke /dashboard
```

### 8.3 Session & Middleware
```
Setiap request ke route protected:
  → middleware.ts cek session via createServerClient
  → Jika tidak ada session → redirect ke /login
  → Jika ada session → lanjutkan + refresh token

Protected routes: /dashboard /students /kedisiplinan /prestasi /admin /superadmin /account
Public routes: / /login /signup
```

### 8.4 Role-Based Access
```
user      → /dashboard, /students, /kedisiplinan/*, /prestasi/*, /account
admin     → semua user routes + /admin/*
superadmin → semua routes
```

---

## 9. HALAMAN & FITUR (DETAIL LENGKAP)

### 9.1 Landing Page (/)
**Komponen yang harus ada (urutan dari atas ke bawah):**
1. Navbar: logo "SQA" + dark/light toggle (sticky, transparent)
2. Hero Section:
   - Logo SVG (inisial SQA, hijau + emas)
   - H1: "SQA"
   - Tagline: "Platform Digital Yang Membantu Guru Di Lingkungan Sekolah Quran Asy Syahid"
   - Button CTA: "Masuk Ke Aplikasi" → navigate ke /login (warna primary hijau)
   - Teks kecil: "Dibuat dengan hati oleh : Unggul Sulaiman, S.Kom (Guru Informatika), 2026"
3. Feature Cards (3 cards horizontal):
   - Card 1: icon + "Data Siswa" + "Kelola data siswa SD, SMP, dan SMA dalam satu platform"
   - Card 2: icon + "Kedisiplinan" + "Pantau dan catat pelanggaran serta penghargaan siswa"
   - Card 3: icon + "Prestasi" + "Dokumentasikan pencapaian siswa dalam berbagai kejuaraan"
4. Stats Section:
   - "3 Unit Sekolah" (SD • SMP • SMA)
   - "1 Platform" (Terintegrasi)
   - "100% Digital" (Paperless)
5. Footer: "©2026 InspiraLabs · Unggul Sulaiman, S.Kom"

**Visual requirements:**
- Subtle dot/grid pattern background
- Smooth fade-in animations (CSS keyframes, tanpa library)
- Fully responsive
- Dark mode support

### 9.2 Login Page (/login)
- Card centered, max-w-md
- Fields: Username, Password (dengan show/hide toggle, icon Eye/EyeOff dari lucide)
- Button "Masuk" dengan loading state
- Link "Belum punya akun? Daftar di sini" → /signup
- Error state: tampilkan alert merah dengan pesan error
- Success: redirect otomatis ke /dashboard

### 9.3 Signup Page (/signup)
- Card centered, max-w-md
- Fields (urutan):
  1. Nama Lengkap (required)
  2. Guru Mapel / Jabatan (required)
  3. Email (required, format email)
  4. Username (required, min 3 char, hanya alphanumeric + underscore)
  5. Password (required, min 8 char, show/hide)
  6. Konfirmasi Password (must match password)
- Button "Daftar" dengan loading state
- Success state: tampilkan card sukses (ganti form), bukan redirect
- Link "Sudah punya akun? Masuk" → /login

### 9.4 Dashboard (/dashboard) — Role: user/admin/superadmin
**Layout:** Grid responsive

**Section 1 — Summary Cards (4 cards):**
- Total Siswa SD (query: COUNT dari students WHERE unit='SD')
- Total Siswa SMP (query: COUNT dari students WHERE unit='SMP')
- Total Siswa SMA (query: COUNT dari students WHERE unit='SMA')
- Total Seluruh Siswa (total)

**Section 2 — Grafik Siswa:**
- Bar chart grouped: jumlah siswa per kelas, grouped by jenis_kelamin
- Filter: unit (SD/SMP/SMA tabs)
- Warna: Laki-laki = primary hijau, Perempuan = secondary emas

**Section 3 — Grafik Kedisiplinan:**
- Pie/Donut chart: distribusi status (Belum Diproses/Pending/Sudah Diproses)
- Bar chart horizontal: top 5 kategori terbanyak

**Section 4 — Grafik Prestasi:**
- Bar chart: prestasi per unit per tingkat kejuaraan
- Counter: total prestasi bulan ini

**Section 5 — Recent Activity:**
- Tabel 5 baris: tanggal | nama siswa | kategori | status badge
- Link "Lihat semua" → /kedisiplinan/data

**Query method:** Semua via src/lib/queries/dashboard.ts menggunakan Supabase client

### 9.5 Data Siswa (/students) — Role: user/admin/superadmin
**Layout:** Tabs SD | SMP | SMA

**Per tab:**
- Tabel dengan kolom: No | Nama | Kelas | Jenis Kelamin | Aksi (Edit, Hapus)
- Fitur tabel: sort per kolom, search by nama (debounced 300ms), pagination
- Pagination options: 10, 20, 30, 40, 50 (default 10)
- Checkbox per row + select all → muncul action bar "Hapus X item terpilih"
- Header actions:
  - Button "Tambah Siswa" (+ icon) → Dialog form single
  - Button "Import Banyak" (Upload icon) → Dialog bulk import

**Dialog Tambah/Edit Siswa:**
- Fields: Nama (input), Kelas (input), Jenis Kelamin (radio L/P)
- Unit: auto-sesuai tab yang aktif (hidden field)
- Validasi Zod

**Dialog Bulk Import:**
- Textarea untuk input format CSV: `Nama,Kelas,JenisKelamin` satu per baris
- Preview tabel sebelum submit
- Button "Import" → bulk insert

**Queries (src/lib/queries/students.ts):**
```typescript
getStudents(unit: Unit, options?: { search?: string, page?: number, pageSize?: number })
createStudent(data: CreateStudentInput)
updateStudent(id: string, data: UpdateStudentInput)
deleteStudents(ids: string[])
bulkCreateStudents(data: CreateStudentInput[])
getStudentCount(unit?: Unit)
```

### 9.6 Kedisiplinan Dashboard (/kedisiplinan) — Role: user/admin/superadmin
**Filter Bar (multiple select semua):**
- Tahun (multi-select, dari data yang ada)
- Unit Sekolah (SD/SMP/SMA multi-select)
- Kategori (dari tabel kategori_disiplin)
- Divisi (dari tabel divisi)

**Charts:**
- Line chart: tren kasus per bulan dalam tahun terpilih
- Bar chart: distribusi per kategori
- Bar chart: distribusi per divisi
- Donut chart: breakdown status

### 9.7 CRUD Kedisiplinan (/kedisiplinan/data)
**Tabel kolom:** No | Tanggal | Diberikan Oleh | Nama Siswa | Kelas | Kategori | Divisi | Pasal | Tindakan | Status | Aksi
**Pagination:** 10,20,30,40,50 (default 10)
**Sort:** semua kolom
**Bulk actions:** Tambah Banyak | Edit Terpilih | Hapus Terpilih
**Status badge:** Belum Diproses (merah) | Pending (kuning) | Sudah Diproses (hijau)

**Form Dialog — Field & Behavior:**
```
1. Tanggal          → DatePicker (react-day-picker, format dd/MM/yyyy)
2. Diberikan Oleh   → Auto-fill dari profile.nama_lengkap (read-only, disabled)
3. Nama Siswa       → Combobox: ketik → debounced search ke tabel students → tampil "Nama - Kelas"
                       → onSelect: set siswa_id, set kelas otomatis
4. Kelas            → Read-only, auto-fill setelah siswa dipilih
5. Kategori         → Combobox: ketik → search tabel kategori_disiplin → tampil nama_kategori
                       → onSelect: set kategori_id, RESET pasal dan tindakan
6. Divisi           → Combobox: ketik → search tabel divisi → tampil nama_divisi
7. Pasal            → Combobox: DISABLED sampai kategori dipilih
                       → Filter: WHERE pasal.kategori_id = selected kategori_id
                       → Tampil: "nama_pasal (poin)"
8. Tindakan         → Combobox: DISABLED sampai kategori dipilih
                       → Filter: WHERE tindakan.kategori_id = selected kategori_id
9. Status           → Select: 'Belum Diproses' | 'Pending' | 'Sudah Diproses'
```

### 9.8 CRUD Master Data Kedisiplinan
**Kategori (/kedisiplinan/kategori):**
- Kolom: No | Nama Kategori | Aksi (Edit, Hapus)
- Pagination: 5,10,15,20,25,30,40,50 (default 5)
- Sort semua kolom

**Divisi (/kedisiplinan/divisi):**
- Kolom: No | Nama Divisi | Unit | Aksi
- Unit: dropdown SD/SMP/SMA saat form add/edit
- Pagination: 5,10,15,20,25,30,40,50 (default 5)

**Pasal (/kedisiplinan/pasal):**
- Kolom: No | Nama Pasal | Kategori | Poin | Aksi
- Kategori: Select dari tabel kategori_disiplin
- Poin: number input
- Pagination: 5,10,15,20,25,30,40,50 (default 5)

**Tindakan (/kedisiplinan/tindakan):**
- Kolom: No | Nama Tindakan | Kategori | Aksi
- Kategori: Select dari tabel kategori_disiplin
- Pagination: 5,10,15,20,25,30,40,50 (default 5)

### 9.9 Cetak Laporan Kedisiplinan (/kedisiplinan/cetak)
**Filter:** Tanggal Dari | Tanggal Sampai | Unit | Kategori | Divisi | Status
**Preview:** Tabel lengkap hasil filter
**Print:** window.print() dengan CSS @media print (sembunyikan UI, tampilkan header formal)
**Header print:** Nama Sekolah | Judul Laporan | Tanggal Cetak | Dicetak Oleh

### 9.10 Prestasi Dashboard (/prestasi) — Role: user/admin/superadmin
**Filter:** Tahun | Unit | Juara | Tingkat Kejuaraan | Kategori (semua multi-select)
**Charts:**
- Line chart: tren per bulan
- Bar chart: distribusi per tingkat kejuaraan
- Bar chart: distribusi per bidang
- Donut chart: Individu vs Kelompok

### 9.11 CRUD Prestasi (/prestasi/data)
**Tabel kolom:** No | Unit | Nama Siswa | Kelas | Event | Tempat | Waktu | Juara | Jenis Juara | Bidang | Kategori | Tingkat | Aksi
**Pagination:** 10,20,30,40,50 (default 10)

**Form Dialog — Field & Behavior:**
```
1. Unit             → Select: SD | SMP | SMA
                       → onSelect: RESET siswa_id
2. Nama Siswa       → Combobox: search tabel students WHERE unit = selected unit
                       → tampil "Nama - Kelas", onSelect: set kelas otomatis
3. Kelas            → Read-only auto-fill
4. Event            → Combobox: search tabel event → tampil nama_event
5. Tempat           → RadioGroup: Offline | Online
6. Waktu            → DatePicker (dd/MM/yyyy)
7. Juara            → Combobox: search tabel juara → tampil nama_juara
8. Jenis Juara      → RadioGroup: Individu | Kelompok
9. Bidang           → Combobox: search tabel bidang → tampil nama_bidang
10. Kategori        → Combobox: search tabel kategori_prestasi → tampil nama_kategori
11. Tingkat Kejuaraan → Select dropdown:
                         'Tingkat Sekolah' | 'Tingkat Lokal' | 'Tingkat Kecamatan' |
                         'Tingkat Kabupaten/Kota' | 'Tingkat Provinsi' | 'Tingkat Regional' |
                         'Tingkat Nasional' | 'Tingkat Internasional'
```

### 9.12 CRUD Master Data Prestasi
**Event (/prestasi/event):** No | Nama Event | Penyelenggara | Aksi
**Juara (/prestasi/juara):** No | Nama Juara | Aksi
**Bidang (/prestasi/bidang):** No | Nama Bidang | Aksi
**Kategori (/prestasi/kategori):** No | Nama Kategori | Aksi
Semua dengan pagination 5,10,15,20,25,30,40,50 (default 5)

### 9.13 Account Page (/account)
- Avatar besar (klik → upload foto → Supabase Storage bucket: 'avatars')
- Form edit: Nama Lengkap, Guru Mapel
- Read-only: Email, Username, Role (badge)
- Form ganti password: Password Lama | Password Baru | Konfirmasi
- Toast sukses/gagal

### 9.14 Admin — Overview (/admin/overview)
- Quick stats: Total User | User Pending | Total Siswa | Total Kedisiplinan | Total Prestasi
- Pending list: user dengan is_approved=false + tombol Approve inline
- Recent audit log (5 baris terbaru)

### 9.15 Admin — Kelola User (/admin/users)
- Tabel profiles dengan kolom: No | Nama | Username | Email | Guru Mapel | Role | Status | Tgl Daftar | Aksi
- Aksi per row: Approve/Revoke toggle | Ubah Role | Hapus
- Bulk: Approve Terpilih | Hapus Terpilih
- Filter: Role | Status Approved
- Pagination: 10,20,30,40,50 (default 10)

### 9.16 Admin — Pengumuman (/admin/announcements)
- CRUD dari tabel announcements (exclude records dengan title='SYSTEM_CONFIG')
- Form: Title | Content (textarea)
- Tabel dengan pagination

### 9.17 Superadmin — Dashboard (/superadmin)
- System overview: records count per tabel
- Activity heatmap (7 hari dari audit_log)
- Top 5 active users

### 9.18 Superadmin — Role Management (/superadmin/roles)
- Tabel semua user + ubah role + toggle approved + reset password + delete

### 9.19 Superadmin — Audit Log (/superadmin/audit)
- Tabel audit_log lengkap dengan filter dan pagination
- Old/New data: collapsible JSON viewer
- Export CSV (native JS, tanpa library)

### 9.20 Superadmin — Analytics (/superadmin/analytics)
- Tren user per bulan
- Tren data entry per bulan (kedisiplinan + prestasi multi-series)
- Breakdown per unit (pie)
- Top 10 siswa kasus terbanyak (horizontal bar)
- Top 10 siswa prestasi terbanyak (horizontal bar)

### 9.21 Superadmin — Settings (/superadmin/settings)
- App Config (simpan di announcements WHERE title='SYSTEM_CONFIG')
- School units management
- Data export (CSV per tabel, native JS)
- Clear data dengan double confirmation

---

## 10. KOMPONEN REUSABLE (WAJIB DIBUAT, WAJIB DIGUNAKAN)

### 10.1 DataTable (src/components/shared/data-table.tsx)
```typescript
interface DataTableProps<T> {
  columns: ColumnDef<T>[]
  data: T[]
  pagination: { page: number, pageSize: number, total: number }
  pageSizeOptions: number[]
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
  onSortChange: (field: string, direction: 'asc' | 'desc') => void
  selectedRows?: string[]
  onSelectRows?: (ids: string[]) => void
  isLoading?: boolean
}
```

### 10.2 Combobox (src/components/shared/combobox.tsx)
```typescript
interface ComboboxProps {
  options: { value: string; label: string }[]
  value?: string
  onSelect: (value: string, label: string) => void
  onSearch: (query: string) => void
  placeholder?: string
  disabled?: boolean
  isLoading?: boolean
}
```
Menggunakan cmdk (Command component). Debounce 300ms pada onSearch.

### 10.3 DatePicker (src/components/shared/date-picker.tsx)
```typescript
interface DatePickerProps {
  value?: Date
  onChange: (date: Date | undefined) => void
  placeholder?: string
  disabled?: boolean
}
```
Menggunakan react-day-picker. Format display: dd/MM/yyyy.

### 10.4 ConfirmDialog (src/components/shared/confirm-dialog.tsx)
```typescript
interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  onConfirm: () => void
  isLoading?: boolean
  variant?: 'destructive' | 'default'
}
```

### 10.5 StatCard (src/components/shared/stat-card.tsx)
```typescript
interface StatCardProps {
  title: string
  value: number | string
  icon: LucideIcon
  description?: string
  variant?: 'default' | 'primary' | 'secondary'
}
```

---

## 11. SIDEBAR MENU STRUCTURE

### Role: user
```
📊 Dashboard          → /dashboard
👥 Data Siswa         → /students
⚖️ Kedisiplinan       → (collapsible)
   ├─ Dashboard       → /kedisiplinan
   ├─ Data            → /kedisiplinan/data
   ├─ Kategori        → /kedisiplinan/kategori
   ├─ Divisi          → /kedisiplinan/divisi
   ├─ Pasal           → /kedisiplinan/pasal
   ├─ Tindakan        → /kedisiplinan/tindakan
   └─ Cetak Laporan   → /kedisiplinan/cetak
🏆 Prestasi           → (collapsible)
   ├─ Dashboard       → /prestasi
   ├─ Data            → /prestasi/data
   ├─ Event           → /prestasi/event
   ├─ Juara           → /prestasi/juara
   ├─ Bidang          → /prestasi/bidang
   ├─ Kategori        → /prestasi/kategori
   └─ Cetak Laporan   → /prestasi/cetak
```

### Role: admin (semua menu user +)
```
🛡️ Admin              → (collapsible)
   ├─ Overview        → /admin/overview
   ├─ Kelola User     → /admin/users
   └─ Pengumuman      → /admin/announcements
```

### Role: superadmin (semua menu admin +)
```
⚙️ Superadmin         → (collapsible)
   ├─ Dashboard       → /superadmin
   ├─ Role Management → /superadmin/roles
   ├─ Audit Log       → /superadmin/audit
   ├─ Analytics       → /superadmin/analytics
   └─ System Settings → /superadmin/settings
```

---

## 12. HEADER (POJOK KANAN ATAS)

Urutan dari kiri ke kanan:
1. Page title (nama halaman current, dinamis)
2. [spacer]
3. Dark/Light mode toggle (icon Sun/Moon dari lucide-react)
4. Avatar foto profil (klik → dropdown):
   - "Akun Saya" → /account
   - Separator
   - "Logout" (warna merah/destructive)

---

## 13. POLA QUERY SUPABASE (WAJIB DIIKUTI)

### Client-side (React components):
```typescript
import { createClient } from '@/lib/supabase/client'
const supabase = createClient()
```

### Server-side (Server Components, Server Actions):
```typescript
import { createClient } from '@/lib/supabase/server'
const supabase = await createClient()
```

### Query dengan join (contoh):
```typescript
const { data, error } = await supabase
  .from('kedisiplinan')
  .select(`
    *,
    students (id, nama, kelas),
    kategori_disiplin (id, nama_kategori),
    divisi (id, nama_divisi),
    pasal (id, nama_pasal, poin),
    tindakan (id, nama_tindakan)
  `)
  .order('tanggal', { ascending: false })
  .range(from, to)
```

### Error handling (selalu):
```typescript
const { data, error } = await supabase.from('table').select()
if (error) throw new Error(error.message)
return data
```

---

## 14. AUDIT LOG IMPLEMENTATION

Setiap operasi write WAJIB memanggil:
```typescript
import { logAudit } from '@/lib/audit/log'

// Setelah create:
await logAudit(userId, 'CREATE', 'students', newRecord.id, null, newRecord)

// Setelah update:
await logAudit(userId, 'UPDATE', 'students', id, oldData, newData)

// Setelah delete:
await logAudit(userId, 'DELETE', 'students', id, oldData, null)
```

---

## 15. VALIDASI ZOD (REFERENSI)

```typescript
// Student
const studentSchema = z.object({
  nama: z.string().min(2, 'Nama minimal 2 karakter'),
  kelas: z.string().min(1, 'Kelas wajib diisi'),
  jenis_kelamin: z.enum(['L', 'P'], { required_error: 'Pilih jenis kelamin' }),
  unit: z.enum(['SD', 'SMP', 'SMA'])
})

// Login
const loginSchema = z.object({
  username: z.string().min(1, 'Username wajib diisi'),
  password: z.string().min(1, 'Password wajib diisi')
})

// Signup
const signupSchema = z.object({
  nama_lengkap: z.string().min(2, 'Nama minimal 2 karakter'),
  guru_mapel: z.string().min(1, 'Guru mapel wajib diisi'),
  email: z.string().email('Format email tidak valid'),
  username: z.string()
    .min(3, 'Username minimal 3 karakter')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username hanya boleh huruf, angka, dan underscore'),
  password: z.string().min(8, 'Password minimal 8 karakter'),
  confirm_password: z.string()
}).refine(data => data.password === data.confirm_password, {
  message: 'Password tidak cocok',
  path: ['confirm_password']
})

// Kedisiplinan
const kedisiplinanSchema = z.object({
  tanggal: z.date({ required_error: 'Tanggal wajib diisi' }),
  siswa_id: z.string().uuid('Pilih siswa'),
  kategori_id: z.string().uuid('Pilih kategori'),
  divisi_id: z.string().uuid('Pilih divisi'),
  pasal_id: z.string().uuid('Pilih pasal'),
  tindakan_id: z.string().uuid('Pilih tindakan'),
  status: z.enum(['Belum Diproses', 'Pending', 'Sudah Diproses'])
})
```

---

## 16. CETAK LAPORAN — CSS PRINT

```css
@media print {
  /* Sembunyikan sidebar, header, filter bar, tombol */
  .no-print { display: none !important; }
  
  /* Tampilkan header formal */
  .print-header { display: block !important; }
  
  /* Reset background */
  body { background: white !important; color: black !important; }
  
  /* Tabel border hitam */
  table, th, td { border: 1px solid #333 !important; }
}
```

**Header print yang ditampilkan:**
```
SEKOLAH QURAN ASY SYAHID
[Judul Laporan]
Tanggal Cetak: [tanggal hari ini]
Dicetak Oleh: [nama_lengkap dari profile]
```

---

## 17. DEPLOYMENT CHECKLIST

- [ ] Semua TypeScript error = 0
- [ ] `npm run build` berhasil tanpa error
- [ ] `.env.local` tidak ter-commit ke git
- [ ] `.gitignore` include: `.env.local`, `.next/`, `node_modules/`
- [ ] Vercel environment variables sudah diset
- [ ] Supabase RLS policies sudah dikonfigurasi (jika diperlukan)
- [ ] `vercel.json` ada di root

---

## 18. CATATAN PENTING

1. **Bahasa UI:** Indonesia (semua label, placeholder, error message dalam Bahasa Indonesia)
2. **Format tanggal display:** dd/MM/yyyy (contoh: 09/06/2026)
3. **Format tanggal database:** yyyy-MM-dd (ISO format untuk Supabase)
4. **Timezone:** WIB (Asia/Jakarta)
5. **Pagination:** berbasis halaman (page-based), bukan cursor-based
6. **Search/filter:** semua operasi search menggunakan ilike di Supabase (case-insensitive)
7. **Image storage:** Supabase Storage bucket nama 'avatars' untuk foto profil
8. **Toast notifications:** gunakan hook use-toast.ts yang sudah dibuat
9. **Loading states:** setiap data fetch harus ada Skeleton loading
10. **Empty states:** setiap tabel kosong tampilkan EmptyState component
