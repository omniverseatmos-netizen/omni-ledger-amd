import { OmNiCore } from './domain.mjs';
import { RbacService, RbacError, tokenDigest } from './pilot-rbac.mjs';
import { emptyPilotState } from './pilot-persistence.mjs';
import crypto from 'node:crypto';
const cryptoHash = value => crypto.createHash('sha256').update(String(value)).digest('hex');

export class PilotService {
  constructor({ store, rbac = new RbacService(), coreFactory = data => data ? OmNiCore.fromJSON(data, { verify: true }) : null, clock = () => new Date() } = {}) { this.store = store; this.rbac = rbac; this.coreFactory = coreFactory; this.clock = clock; }
  async bootstrap({ admin }) { return this.store.transaction(state => { if (state.users.length) return { created: false }; const user = this.rbac.createUser(admin); state.users.push(user); return { created: true, userId: user.id }; }); }
  async login({ email, password }) {
    // Password hashing (scrypt) is CPU-heavy: verify it OUTSIDE the transaction so it never holds the state lock.
    const snapshot = await this.store.read();
    const user = snapshot.users.find(x => x.email === String(email || '').trim().toLowerCase());
    const session = this.rbac.login(user, password);
    return this.store.transaction(state => { state.sessions = state.sessions.filter(x => new Date(x.expiresAt).getTime() > this.clock().getTime()); state.sessions.push({ ...session, roles: user.roles, token: undefined }); return { ...session, roles: user.roles, displayName: user.displayName }; });
  }
  async loginExternal({ subject, email, displayName, tenantId, roles }) {
    if (!subject || !email || !tenantId) throw new RbacError('OIDC_PROFILE_INVALID', 'OIDC profile is incomplete.', 401);
    const safeRoles = [...new Set((roles || []).filter(role => ['recall_operator', 'quality_officer', 'qa_manager', 'operations_manager', 'auditor', 'pilot_admin'].includes(role)))];
    if (!safeRoles.length) throw new RbacError('OIDC_ROLE_REQUIRED', 'No allowed AtMoS role was present in OIDC claims.', 403);
    const snapshot = await this.store.read();
    let user = snapshot.users.find(x => x.tenantId === tenantId && x.externalSubject === String(subject));
    if (!user) {
      user = this.rbac.createUser({ id: `oidc-${cryptoHash(`${tenantId}:${subject}`).slice(0, 24)}`, email, displayName: displayName || email, roles: safeRoles, tenantId, externalSubject: String(subject) });
    }
    const session = this.rbac.issueSession(user);
    return this.store.transaction(state => {
      const existing = state.users.find(x => x.id === user.id);
      if (!existing) state.users.push(user); else { existing.email = user.email; existing.displayName = user.displayName; existing.roles = safeRoles; existing.active = true; existing.externalSubject = String(subject); }
      state.sessions = state.sessions.filter(x => new Date(x.expiresAt).getTime() > this.clock().getTime());
      state.sessions.push({ ...session, roles: safeRoles, token: undefined });
      return { ...session, roles: safeRoles, displayName: user.displayName, tenantId };
    });
  }

  async _auth(token, permission) { const digest = tokenDigest(token || ''); const state = await this.store.read(); const session = state.sessions.find(x => x.tokenHash === digest); this.rbac.authenticate(session, permission); const user = state.users.find(x => x.id === session.userId); if (!user?.active) throw new RbacError('USER_INACTIVE', 'User is inactive.', 403); return { state, session: this.rbac.sessionFor({ session, user }), user }; }
  async me(token) { const { session } = await this._auth(token); return session; }
  async createDisposition(token, input, idempotencyKey) {
    const { session } = await this._auth(token, 'disposition:create');
    return this.store.transaction(state => this._idempotent(state, idempotencyKey, 'create-disposition', input, () => {
      const core = this.coreFactory(state.core); if (!core) throw new RbacError('CORE_NOT_INITIALIZED', 'Pilot core is not initialized.', 409);
      const request = core.createDispositionRequest({ ...input, actor: session.userId }); state.core = core.toJSON(); return request;
    }));
  }
  async approveDisposition(token, id, decision = 'APPROVE', note = '', idempotencyKey) {
    const { session } = await this._authAny(token, ['disposition:approve:quality', 'disposition:approve:qa']);
    return this.store.transaction(state => this._idempotent(state, idempotencyKey, 'approve-disposition', { id, decision, note, user: session.userId }, () => {
      const core = this.coreFactory(state.core); const role = session.roles.find(x => x === 'quality_officer' || x === 'qa_manager');
      const request = core.approveDisposition(id, { actor: session.userId, role, decision, note }); state.core = core.toJSON(); return request;
    }));
  }
  async executeDisposition(token, id, idempotencyKey) {
    const { session } = await this._auth(token, 'disposition:execute');
    return this.store.transaction(state => this._idempotent(state, idempotencyKey, 'execute-disposition', { id, user: session.userId }, () => {
      const core = this.coreFactory(state.core); const request = core.executeDisposition(id, { actor: session.userId, role: 'operations_manager' }); state.core = core.toJSON(); return request;
    }));
  }
  async dashboard(token) {
    const { state } = await this._auth(token, 'disposition:read');
    // Read path only: verify + rebuild the core once per snapshot version and reuse it until the version changes. Writes still rebuild and verify.
    const version = state.meta?.version;
    let core;
    if (this._readCore && this._readCore.version === version && version !== undefined) core = this._readCore.core;
    else { core = this.coreFactory(state.core); this._readCore = { version, core }; }
    return { requests: core?.dispositionRequests || [], quarantine: quarantineRows(core), version };
  }
  async _authAny(token, permissions) { for (const permission of permissions) { try { return await this._auth(token, permission); } catch (error) { if (!['PERMISSION_DENIED'].includes(error.code)) throw error; } } throw new RbacError('PERMISSION_DENIED', `Missing one of: ${permissions.join(', ')}.`, 403); }
  _idempotent(state, key, operation, payload, fn) { if (!key || String(key).length < 16) throw new RbacError('IDEMPOTENCY_KEY_REQUIRED', 'An Idempotency-Key of at least 16 characters is required.', 400); const requestHash = JSON.stringify(payload); const existing = state.idempotency.find(x => x.key === key && x.operation === operation); if (existing) { if (existing.requestHash !== requestHash) throw new RbacError('IDEMPOTENCY_CONFLICT', 'The idempotency key was already used with a different request.', 409); return existing.response; } const response = fn(); state.idempotency.push({ key, operation, requestHash, response, createdAt: this.clock().toISOString() }); return response; }
}
function quarantineRows(core) { if (!core) return []; const rows = new Map(); for (const e of core.ledger) { if (e.stockStatus !== 'QUARANTINE') continue; const key = `${e.itemCode}|${e.batch}|${e.warehouseCode}|${e.locationKey}`; const row = rows.get(key) || { itemCode: e.itemCode, batch: e.batch, warehouseCode: e.warehouseCode, locationKey: e.locationKey, qty: 0, expiryDate: e.expiryDate }; row.qty += e.qty; rows.set(key, row); } return [...rows.values()].filter(x => x.qty > 0); }
