import { createClient } from '@/lib/supabase/client'
import type { AuditAction } from '@/lib/supabase/types'

export async function logAudit(
  userId: string,
  action: AuditAction,
  tableName: string,
  recordId: string,
  oldData: Record<string, unknown> | null,
  newData: Record<string, unknown> | null
): Promise<void> {
  const supabase = createClient()
  await supabase.from('audit_log').insert({
    user_id: userId,
    action,
    table_name: tableName,
    record_id: recordId,
    old_data: oldData,
    new_data: newData,
  })
  // Sengaja tidak throw error agar audit log gagal tidak crash aplikasi
}
