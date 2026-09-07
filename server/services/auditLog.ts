import { pb, ensurePBAuth } from '../db';

export interface AuditLogEntry {
  actorId?: string;
  actorEmail?: string;
  action: string;
  targetType?: string;
  targetId?: string;
  detail?: string;
  ip?: string;
}

/**
 * Records a sensitive action to the audit_logs collection. Fire-and-forget by
 * design — an audit write failing must never block or fail the action it's
 * recording, so callers don't need to await this or handle its errors.
 */
export function logAudit(entry: AuditLogEntry): void {
  (async () => {
    try {
      await ensurePBAuth();
      await pb.collection('audit_logs').create(entry);
    } catch (err: any) {
      console.error('[AuditLog] Failed to record audit entry:', entry.action, err.message);
    }
  })();
}

/** Best-effort client IP extraction, accounting for a reverse proxy (Coolify/nginx) in front of the app. */
export function getClientIp(req: any): string {
  const forwarded = req.headers?.['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || 'unknown';
}
