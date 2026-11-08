// Transactional normalized projection for the AtMoS Pilot.
// The legacy pilot_state snapshot remains during migration; both are written in
// the same PostgreSQL transaction so parity can be proven before cutover.

const json = value => JSON.stringify(value ?? null);
const ids = rows => rows.map(row => String(row.id));

async function syncById(client, { table, tenantId, rows, columns, values }) {
  const currentIds = ids(rows);
  if (currentIds.length) {
    await client.query(`DELETE FROM ${table} WHERE tenant_id = $1 AND NOT (id = ANY($2::text[]))`, [tenantId, currentIds]);
  } else {
    await client.query(`DELETE FROM ${table} WHERE tenant_id = $1`, [tenantId]);
  }
  for (const row of rows) {
    await client.query(
      `INSERT INTO ${table} (tenant_id, ${columns.join(', ')}) VALUES ($1, ${columns.map((_, i) => `$${i + 2}`).join(', ')})
       ON CONFLICT (tenant_id, id) DO UPDATE SET ${columns.filter(c => c !== 'id').map(c => `${c} = EXCLUDED.${c}`).join(', ')}`,
      [tenantId, row.id, ...values(row)],
    );
  }
}

export async function persistNormalizedSnapshot(client, { tenantId, state, now = new Date().toISOString() }) {
  const core = state.core || {};
  const recalls = new Map();
  for (const event of core.audit || []) {
    if (event.eventType?.startsWith('RECALL_') && event.afterState?.id) recalls.set(String(event.afterState.id), event.afterState);
  }

  await syncById(client, {
    table: 'pilot_users', tenantId,
    rows: (state.users || []).map(user => ({ ...user, id: String(user.id) })),
    columns: ['id', 'email', 'display_name', 'tenant_id_record', 'password_hash', 'external_subject', 'active', 'data'],
    values: user => [user.email, user.displayName, user.tenantId || tenantId, user.passwordHash || null, user.externalSubject || null, user.active !== false, json(user)],
  });
  await syncById(client, {
    table: 'pilot_sessions', tenantId,
    rows: (state.sessions || []).map(session => ({ ...session, id: String(session.tokenHash) })),
    columns: ['id', 'user_id', 'expires_at', 'revoked_at', 'data'],
    values: session => [session.userId, session.expiresAt, session.revokedAt || null, json(session)],
  });
  await syncById(client, {
    table: 'pilot_recalls', tenantId,
    rows: [...recalls.values()].map(recall => ({ ...recall, id: String(recall.id) })),
    columns: ['id', 'item_code', 'batch', 'warehouse_code', 'status', 'version', 'data'],
    values: recall => [recall.itemCode, recall.batch, recall.warehouseCode, recall.status, Number(recall.version || 0), json(recall)],
  });
  await syncById(client, {
    table: 'pilot_dispositions', tenantId,
    rows: (core.dispositionRequests || []).map(request => ({ ...request, id: String(request.id) })),
    columns: ['id', 'recall_id', 'disposition', 'status', 'requested_by', 'version', 'created_at', 'executed_at', 'data'],
    values: request => [request.recallId, request.disposition, request.status, request.requestedBy, Number(request.version || 0), request.requestedAt || now, request.executedAt || null, json(request)],
  });

  const approvals = [];
  for (const request of core.dispositionRequests || []) {
    for (const approval of request.approvals || []) {
      approvals.push({ id: `${request.id}:${approval.role}`, dispositionId: request.id, actorId: approval.actor, role: approval.role, decision: 'APPROVE', note: approval.note || null, createdAt: approval.at || now, data: approval });
    }
  }
  if (approvals.length) await client.query('DELETE FROM pilot_disposition_approvals WHERE tenant_id = $1 AND NOT (id = ANY($2::text[]))', [tenantId, ids(approvals)]);
  else await client.query('DELETE FROM pilot_disposition_approvals WHERE tenant_id = $1', [tenantId]);
  for (const approval of approvals) {
    await client.query(`INSERT INTO pilot_disposition_approvals (tenant_id, id, disposition_id, actor_id, role, decision, note, created_at, data)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)
      ON CONFLICT (tenant_id, id) DO UPDATE SET actor_id=EXCLUDED.actor_id, decision=EXCLUDED.decision, note=EXCLUDED.note, created_at=EXCLUDED.created_at, data=EXCLUDED.data`,
      [tenantId, approval.id, approval.dispositionId, approval.actorId, approval.role, approval.decision, approval.note, approval.createdAt, json(approval.data)]);
  }

  // The domain core's ledger/audit entries carry no `seq` field (append-only arrays chained by prevHash/hash),
  // so the sequence number is the 1-based array position. `event.seq || 0` gave every row sequence 0 and violated
  // UNIQUE (tenant_id, sequence_no) as soon as there were two events.
  const positionOf = list => new Map((list || []).map((event, index) => [String(event.id), index + 1]));
  const ledgerPos = positionOf(core.ledger);
  const auditPos = positionOf(core.audit);
  await syncById(client, {
    table: 'pilot_ledger_events', tenantId,
    rows: (core.ledger || []).map(event => ({ ...event, id: String(event.id) })),
    columns: ['id', 'sequence_no', 'event_hash', 'previous_hash', 'event_type', 'source_id', 'created_at', 'data'],
    values: event => [Number.isFinite(Number(event.seq)) && Number(event.seq) > 0 ? Number(event.seq) : ledgerPos.get(event.id), event.hash, event.prevHash || 'GENESIS', event.type, event.sourceId || null, event.at || event.timestamp || event.createdAt || now, json(event)],
  });
  await syncById(client, {
    table: 'pilot_audit_events', tenantId,
    rows: (core.audit || []).map(event => ({ ...event, id: String(event.id) })),
    columns: ['id', 'sequence_no', 'event_hash', 'previous_hash', 'event_type', 'source_id', 'created_at', 'data'],
    values: event => [Number.isFinite(Number(event.seq)) && Number(event.seq) > 0 ? Number(event.seq) : auditPos.get(event.id), event.hash, event.prevHash || 'GENESIS', event.eventType, event.sourceId || null, event.at || event.timestamp || event.createdAt || now, json(event)],
  });

  const idempotency = (state.idempotency || []).map(row => ({ id: `${tenantId}:${row.operation}:${row.key}`, operation: row.operation, key: row.key, request_hash: row.requestHash, response: row.response, created_at: row.createdAt || now, data: row }));
  if (idempotency.length) await client.query('DELETE FROM pilot_idempotency_keys WHERE tenant_id = $1 AND NOT (id = ANY($2::text[]))', [tenantId, ids(idempotency)]);
  else await client.query('DELETE FROM pilot_idempotency_keys WHERE tenant_id = $1', [tenantId]);
  for (const row of idempotency) {
    await client.query(`INSERT INTO pilot_idempotency_keys (tenant_id, id, operation, key, request_hash, response, created_at, data)
      VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8::jsonb)
      ON CONFLICT (tenant_id, id) DO UPDATE SET request_hash=EXCLUDED.request_hash, response=EXCLUDED.response, data=EXCLUDED.data`,
      [tenantId, row.id, row.operation, row.key, row.request_hash, json(row.response), row.created_at, json(row.data)]);
  }
}
