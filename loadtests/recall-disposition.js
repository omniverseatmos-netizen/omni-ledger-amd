import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

const base = (__ENV.BASE_URL || 'http://127.0.0.1:4180').replace(/\/$/, '');
const token = __ENV.PILOT_TOKEN;
// recall_operator has NO disposition:read permission. Use READ_TOKEN (e.g. auditor) for dashboard reads.
const readToken = __ENV.READ_TOKEN || token;
// 201 = created; 409 = a deterministic business rule said no. Both are expected, not failures.
http.setResponseCallback(http.expectedStatuses(200, 201, 409));
const batches = (__ENV.RECALL_BATCHES || '').split(',').map(x => x.trim()).filter(Boolean);
const recallSuccess = new Counter('recall_success');
const duplicateOrConflict = new Counter('recall_duplicate_or_conflict');
const apiErrors = new Counter('api_errors');
const apiLatency = new Trend('api_latency_ms', true);
const successRate = new Rate('business_success_rate');

export const options = {
  scenarios: {
    recall_control_plane: {
      executor: 'ramping-arrival-rate',
      startRate: Number(__ENV.START_RATE || 20),
      timeUnit: '1s',
      preAllocatedVUs: Number(__ENV.PREALLOCATED_VUS || 100),
      maxVUs: Number(__ENV.MAX_VUS || 2000),
      stages: [
        { target: Number(__ENV.RAMP_RATE || 200), duration: __ENV.RAMP_DURATION || '2m' },
        { target: Number(__ENV.HOLD_RATE || 500), duration: __ENV.HOLD_DURATION || '5m' },
        { target: 0, duration: __ENV.DOWN_DURATION || '2m' },
      ],
      gracefulStop: '30s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    business_success_rate: ['rate>0.99'],
    api_errors: ['count<100'],
  },
};

function headers(bearer = token) { return { Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json', 'X-Tenant-Id': __ENV.TENANT_ID || 'T1' }; }
export default function () {
  if (!token || !batches.length) { throw new Error('Set PILOT_TOKEN and RECALL_BATCHES before running the load test.'); }
  const batch = batches[(__VU + __ITER) % batches.length];
  const idempotency = `k6-${__VU}-${__ITER}-${Date.now()}`;
  const createPayload = JSON.stringify({ itemCode: __ENV.ITEM_CODE || 'PARA-500', batch, warehouseCode: __ENV.WAREHOUSE_CODE || 'WH-OCT6', disposition: 'HOLD', refNo: `K6-${batch}-${__VU}-${__ITER}`, reason: 'Controlled distributed load test' });
  const response = http.post(`${base}/v1/dispositions`, createPayload, { headers: { ...headers(), 'Idempotency-Key': idempotency }, tags: { operation: 'create_disposition' } });
  apiLatency.add(response.timings.duration);
  const ok = check(response, { 'HTTP is not 5xx': r => r.status < 500, 'response is JSON': r => String(r.headers['Content-Type'] || '').includes('application/json') });
  if (response.status === 201) recallSuccess.add(1);
  else if ([409, 400].includes(response.status)) duplicateOrConflict.add(1);
  else if (!ok) apiErrors.add(1);
  successRate.add(ok && [201, 409].includes(response.status));
  const dashboard = http.get(`${base}/v1/dispositions/dashboard`, { headers: headers(readToken), tags: { operation: 'dashboard_read' } });
  apiLatency.add(dashboard.timings.duration);
  check(dashboard, { 'dashboard is 200': r => r.status === 200 }) || apiErrors.add(1);
  sleep(Number(__ENV.SLEEP_SECONDS || 0.1));
}
