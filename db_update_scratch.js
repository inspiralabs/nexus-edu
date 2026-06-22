const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

const envPath = path.resolve(__dirname, '.env.local')
const envContent = fs.readFileSync(envPath, 'utf8')
const env = {}
envContent.split('\n').forEach((line) => {
  const parts = line.split('=')
  if (parts.length >= 2) {
    const key = parts[0].trim()
    const val = parts.slice(1).join('=').trim()
    env[key] = val
  }
})

const supabase = createClient(env['NEXT_PUBLIC_SUPABASE_URL'], env['SUPABASE_SERVICE_ROLE_KEY'])

async function run() {
  console.log('Fetching tipe_nilai configuration...')
  const { data: tipeList, error: tipeErr } = await supabase
    .from('tipe_nilai')
    .select('id, jenis_nilai')

  if (tipeErr) {
    console.error('Error fetching tipe_nilai:', tipeErr.message)
    return
  }

  const tipeMap = new Map(tipeList.map((t) => [t.id, t.jenis_nilai]))
  console.log(`Loaded ${tipeList.length} tipe_nilai configurations.`)

  console.log('Fetching all nilai_harian records...')
  const { data: harianList, error: harianErr } = await supabase
    .from('nilai_harian')
    .select('id, tipe_nilai, tipe_nilai_id')

  if (harianErr) {
    console.error('Error fetching nilai_harian:', harianErr.message)
    return
  }

  console.log(`Loaded ${harianList.length} nilai_harian records. Checking mismatch...`)
  let updateCount = 0

  for (const h of harianList) {
    if (h.tipe_nilai_id) {
      const jenis = tipeMap.get(h.tipe_nilai_id)
      if (jenis) {
        const expectedTipe = jenis === 'Harian' ? 'Formatif' : 'Sumatif'
        if (h.tipe_nilai !== expectedTipe) {
          const { error: updateErr } = await supabase
            .from('nilai_harian')
            .update({ tipe_nilai: expectedTipe })
            .eq('id', h.id)

          if (updateErr) {
            console.error(`Failed to update record ${h.id}:`, updateErr.message)
          } else {
            updateCount++
          }
        }
      }
    }
  }

  console.log(`Cleanup completed successfully. Updated ${updateCount} records.`)
}

run()
