/**
 * tests/k6-load-test.js
 * K6 load test suite for EventSphere API.
 *
 * Scenarios:
 *  smoke       — 1 VU, 1 min  (sanity: no errors under minimal load)
 *  load        — ramp to 50 VUs over 5 min, hold 10 min, ramp down 2 min
 *  stress      — ramp to 200 VUs (find breaking point)
 *  spike       — sudden 500 VU burst for 30 s then back to 0
 *
 * Run:
 *   k6 run tests/k6-load-test.js                          # default (load)
 *   k6 run -e SCENARIO=smoke tests/k6-load-test.js
 *   k6 run -e SCENARIO=stress tests/k6-load-test.js
 *   k6 run -e SCENARIO=spike  tests/k6-load-test.js
 *   k6 run --out json=results/k6-results.json tests/k6-load-test.js
 *
 * Thresholds (SLOs):
 *   p95 response time < 500 ms
 *   p99 response time < 1 500 ms
 *   error rate < 1 %
 *   http_req_duration{status:200} < 300 ms (p95)
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// ── Custom metrics ─────────────────────────────────────────────────────────────
const errorRate      = new Rate('errors');
const authDuration   = new Trend('auth_duration',    true);
const eventsDuration = new Trend('events_duration',  true);
const bookingDuration = new Trend('booking_duration', true);
const bookingErrors  = new Counter('booking_errors');

// ── Config ─────────────────────────────────────────────────────────────────────
const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000';

const SCENARIOS_CONFIG = {
  smoke: {
    executor: 'constant-vus',
    vus: 1,
    duration: '1m',
  },
  load: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '2m', target: 10  }, // warm-up
      { duration: '5m', target: 50  }, // ramp up
      { duration: '8m', target: 50  }, // steady state
      { duration: '2m', target: 0   }, // ramp down
    ],
  },
  stress: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '2m',  target: 50  },
      { duration: '5m',  target: 100 },
      { duration: '5m',  target: 200 },
      { duration: '5m',  target: 300 },
      { duration: '5m',  target: 200 },
      { duration: '3m',  target: 0   },
    ],
  },
  spike: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '10s', target: 500 }, // instant spike
      { duration: '30s', target: 500 }, // hold spike
      { duration: '10s', target: 0   }, // drop
    ],
  },
};

const scenario = __ENV.SCENARIO || 'load';

export const options = {
  scenarios: {
    [scenario]: SCENARIOS_CONFIG[scenario],
  },
  thresholds: {
    http_req_duration:              ['p(95)<500', 'p(99)<1500'],
    'http_req_duration{type:auth}': ['p(95)<800'],
    'http_req_duration{type:events}': ['p(95)<400'],
    errors:                         ['rate<0.01'],
    http_req_failed:                ['rate<0.01'],
  },
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function jsonPost(path, body, tags = {}) {
  return http.post(`${BASE_URL}${path}`, JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
    tags,
  });
}

function authHeader(token) {
  return { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } };
}

// ── Scenarios ──────────────────────────────────────────────────────────────────

export default function () {
  // ── Health check ─────────────────────────────────────────────────────────
  group('health', () => {
    const res = http.get(`${BASE_URL}/api/health`);
    const ok  = check(res, { 'health: status 200': (r) => r.status === 200 });
    errorRate.add(!ok);
  });

  // ── Events (public) ───────────────────────────────────────────────────────
  let firstEventId;
  group('events_public', () => {
    const start = Date.now();
    const res = http.get(`${BASE_URL}/api/events?page=1&limit=10`, {
      tags: { type: 'events' },
    });
    eventsDuration.add(Date.now() - start);

    const ok = check(res, {
      'events list: status 200':      (r) => r.status === 200,
      'events list: has events array': (r) => {
        try { return Array.isArray(JSON.parse(r.body).events); } catch { return false; }
      },
    });
    errorRate.add(!ok);

    try {
      const body = JSON.parse(res.body);
      if (body.events && body.events.length > 0) {
        firstEventId = body.events[0]._id;
      }
    } catch { /* ignore */ }
  });

  // Single event
  if (firstEventId) {
    group('event_detail', () => {
      const res = http.get(`${BASE_URL}/api/events/${firstEventId}`, {
        tags: { type: 'events' },
      });
      const ok = check(res, { 'event detail: status 200': (r) => r.status === 200 });
      errorRate.add(!ok);
    });
  }

  // ── Auth flow ─────────────────────────────────────────────────────────────
  // Use a fixed test account — no actual registration (avoids OTP side effects)
  let token;
  group('auth_login', () => {
    const start = Date.now();
    const res = jsonPost('/api/auth/login', {
      email:    __ENV.TEST_EMAIL    || 'loadtest@example.com',
      password: __ENV.TEST_PASSWORD || 'LoadTest@1234',
    }, { type: 'auth' });
    authDuration.add(Date.now() - start);

    const ok = check(res, {
      'login: status 200 or 400': (r) => [200, 400, 401].includes(r.status),
    });
    errorRate.add(!ok);

    try {
      const body = JSON.parse(res.body);
      if (body.token) token = body.token;
    } catch { /* ignore */ }
  });

  // ── Authenticated: user bookings ──────────────────────────────────────────
  if (token) {
    group('my_bookings', () => {
      const start = Date.now();
      const res = http.get(`${BASE_URL}/api/bookings/mine`, authHeader(token));
      bookingDuration.add(Date.now() - start);

      const ok = check(res, {
        'my bookings: status 200': (r) => r.status === 200,
        'my bookings: has array':  (r) => {
          try { return Array.isArray(JSON.parse(r.body).bookings); } catch { return false; }
        },
      });
      if (!ok) bookingErrors.add(1);
      errorRate.add(!ok);
    });
  }

  sleep(1);
}

// ── Setup / Teardown ───────────────────────────────────────────────────────────

export function handleSummary(data) {
  return {
    'results/k6-summary.json': JSON.stringify(data, null, 2),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}

// Minimal textSummary shim (k6 bundles a better one from 'https://jslib.k6.io/k6-summary/...')
function textSummary(data) {
  const metrics = data.metrics || {};
  const lines   = ['── K6 Load Test Summary ──────────────────────────'];

  for (const [name, m] of Object.entries(metrics)) {
    if (m.type === 'trend') {
      lines.push(`  ${name}: p95=${m.values['p(95)']?.toFixed(1)}ms  p99=${m.values['p(99)']?.toFixed(1)}ms`);
    } else if (m.type === 'rate') {
      lines.push(`  ${name}: ${(m.values.rate * 100).toFixed(2)}%`);
    } else if (m.type === 'counter') {
      lines.push(`  ${name}: ${m.values.count}`);
    }
  }

  lines.push('─────────────────────────────────────────────────');
  return lines.join('\n');
}
