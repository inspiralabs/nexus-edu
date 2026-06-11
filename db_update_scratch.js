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
  console.log('Assigning SMP students to Uhud...')
  const { data: smp, error: smpErr } = await supabase
    .from('students')
    .update({ kamar: 'Uhud' })
    .eq('unit', 'SMP')
    
  if (smpErr) console.error('SMP error:', smpErr.message)
  else console.log('SMP students assigned to Uhud.')

  console.log('Assigning SMA students to Zaid...')
  const { data: sma, error: smaErr } = await supabase
    .from('students')
    .update({ kamar: 'Zaid' })
    .eq('unit', 'SMA')
    
  if (smaErr) console.error('SMA error:', smaErr.message)
  else console.log('SMA students assigned to Zaid.')

  console.log('Assigning SD students to Usamah...')
  const { data: sd, error: sdErr } = await supabase
    .from('students')
    .update({ kamar: 'Usamah' })
    .eq('unit', 'SD')
    
  if (sdErr) console.error('SD error:', sdErr.message)
  else console.log('SD students assigned to Usamah.')
}

run()
