// src/lib/constants.ts
// Konstanta global AMANAH Platform — gunakan di semua file yang relevan

export const INSPIRALABS_URL = 'https://inspiralabs.id/'

/** Nomor WhatsApp Pak Unggul (format internasional tanpa +) */
const CREATOR_WHATSAPP_PHONE = '6289635235132'
const CREATOR_WHATSAPP_MESSAGE =
  'Halo Pak Unggul, saya tertarik dengan jasa pembuatan aplikasi custom untuk kami. Boleh tanya-tanya dulu untuk konsultasi sistemnya, Pak?'

export const CREATOR_WHATSAPP = `https://api.whatsapp.com/send?phone=${CREATOR_WHATSAPP_PHONE}&text=${encodeURIComponent(CREATOR_WHATSAPP_MESSAGE)}`

export const APP_NAME = 'AMANAH Platform'
export const APP_FULL_NAME = 'Aplikasi Manajemen Anak & Sekolah'
