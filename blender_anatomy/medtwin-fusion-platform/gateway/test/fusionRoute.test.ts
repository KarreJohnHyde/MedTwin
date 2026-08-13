import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createServer } from '../src/server.js';
import http from 'node:http';

// Minimal in-process fake pulmonary + fusion services so this test doesn't
// depend on the real Python services being up. Swap for real integration
// tests once those services exist (see README "Testing strategy").

let pulmonaryStub: http.Server;
let fusionStub: http.Server;

beforeAll(async () => {
  pulmonaryStub = http
    .createServer((req, res) => {
      let data = '';
      req.on('data', (c) => (data += c));
      req.on('end', () => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', label: 'pneumonia', confidence: 0.82, is_mock: true }));
      });
    })
    .listen(8001);

  fusionStub = http
    .createServer((req, res) => {
      let data = '';
      req.on('data', (c) => (data += c));
      req.on('end', () => {
        const { domain_results } = JSON.parse(data);
        const missing = domain_results.some((d: { status: string }) => d.status !== 'ok');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            findings: [],
            concordance: missing ? 'PARTIAL' : 'CONCORDANT',
            fusion_confidence: missing ? 0.41 : 0.82,
            risk_index: 40,
            forecast: [],
            model_versions: {},
          })
        );
      });
    })
    .listen(8010);

  process.env.PULMONARY_SERVICE_URL = 'http://localhost:8001';
  process.env.FUSION_SERVICE_URL = 'http://localhost:8010';
});

afterAll(() => {
  pulmonaryStub.close();
  fusionStub.close();
});

describe('POST /api/fusion/infer', () => {
  it('returns 400 when patient_id or inputs are missing', async () => {
    const app = createServer();
    const res = await request(app).post('/api/fusion/infer').send({});
    expect(res.status).toBe(400);
  });

  it('discounts fusion_confidence when the image modality is missing (not silently ignored)', async () => {
    const app = createServer();
    const res = await request(app)
      .post('/api/fusion/infer')
      .send({ patient_id: 'PT-001', inputs: { labs: { crp: 12 } } }); // no image

    expect(res.status).toBe(200);
    expect(res.body.concordance).toBe('PARTIAL');
    // This is the core regression test: a missing modality must NOT produce
    // the same (or higher) confidence as a full set of inputs.
    expect(res.body.fusion_confidence).toBeLessThan(0.82);
  });

  it('reports full confidence path when the image is present', async () => {
    const app = createServer();
    const res = await request(app)
      .post('/api/fusion/infer')
      .send({ patient_id: 'PT-001', inputs: { image: 'ZmFrZS1iYXNlNjQ=' } });

    expect(res.status).toBe(200);
    expect(res.body.concordance).toBe('CONCORDANT');
    expect(res.body.fusion_confidence).toBe(0.82);
  });
});
