import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate } from 'k6/metrics';

const base = (__ENV.BASE_URL || 'http://pilot-api:4180').replace(/\/$/, '');
const token = __ENV.PILOT_TOKEN;
const batches = (__ENV.RECALL_BATCHES || '').split(',').map(x => x.trim()).filter(Boolean);
const businessErrors = new Counter('business_errors');
const businessSuccess = new Rate('business_success');
const replicaHeader = __ENV.REPLICA_HEADER || 'x-atmos-replica';

export const options = {
  discardResponseBodies: false,
  scenarios: {
    distributed_writers: { executor: 'ramping-arrival-rate', startRate: Number(__ENV.START_RATE || 20), timeUnit: '1s', preAllocatedVUs: Number(__ENV.PREALLOCATED_VUS || 100), maxVUs: Number(__ENV.MAX_VUS || 2000), stages: [{ target: Number(__ENV.RAMP_RATE || 200), duration: '2m' }, { target: Number(__ENV.HOLD_RATE || 500), duration: '5m' }, { target: 0, duration: '2m' }], gracefulStop: '30s', exec: 'writeAndRead' },
    read_probe: { executor: 'constant-arrival-rate', rate: Number(__ENV.READ_RATE || 50), timeUnit: '1s', duration: __ENV.READ_DURATION || '9m', preAllocatedVUs: 50, maxVUs: 500, exec: 'readOnly' },
  },
  thresholds: { http_req_failed: ['rate<0.01'], http_req_duration: ['p(95)<500', 'p(99)<1000'], business_success: ['rate>0.99'], business_errors: ['count<100'] },
};
function headers() { return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'X-Tenant-Id': __ENV.TENANT_ID || 'T1' }; }
function dashboard() { const r = http.get(`${base}/v1/dispositions/dashboard`, { headers: headers(), tags: { operation: 'dashboard_read' } }); const ok = check(r, { 'dashboard 200': x => x.status === 200, 'json': x => String(x.headers['Content-Type'] || '').includes('application/json') }); if (!ok) businessErrors.add(1); return r; }
export function writeAndRead() {
  if (!token || !batches.length) throw new Error('Set PILOT_TOKEN and RECALL_BATCHES.');
  const batch = batches[(__VU + __ITER) % batches.length];
  const key = `distributed-${__VU}-${__ITER}-${Date.now()}`;
  const r = http.post(`${base}/v1/dispositions`, JSON.stringify({ itemCode: __ENV.ITEM_CODE || 'PARA-500', batch, warehouseCode: __ENV.WAREHOUSE_CODE || 'WH-OCT6', disposition: 'HOLD', refNo: `K6-${batch}-${__VU}-${__ITER}`, reason: 'Controlled distributed load test' }), { headers: { ...headers(), 'Idempotency-Key': key }, tags: { operation: 'create_disposition' } });
  const ok = check(r, { 'write accepted': x => [201, 409].includes(x.status), 'not 5xx': x => x.status < 500 }); if (!ok) businessErrors.add(1); businessSuccess.add(ok); dashboard(); sleep(Number(__ENV.SLEEP_SECONDS || 0.1));
}
export function readOnly() { if (!token) throw new Error('Set PILOT_TOKEN.'); dashboard(); }
export function handleSummary(data) { return { 'results/k6-distributed-summary.json': JSON.stringify({ generatedAt: new Date().toISOString(), metrics: data.metrics, note: 'Run against a disposable environment with multiple API replicas; collect PostgreSQL CPU/IOPS/locks separately.' }, null, 2) }; }
