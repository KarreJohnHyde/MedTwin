# MedTwin Fusion Platform — Phase 0/1 Scaffold

Working, tested implementation of Phase 0 (Node gateway + one FastAPI domain
service + shared types) and the pulmonary slice of Phase 1, per the master
prompt. Everything in this repo has actually been run — see "Verified"
below — not just written.

## What's here

```
gateway/                  Node.js/TypeScript, Express — orchestrates domain calls
  src/types.ts             Canonical request/response contracts (section 8)
  src/services/domainClient.ts   Never-throws HTTP client with timeout handling
  src/routes/fusionRoute.ts      POST /api/fusion/infer
  test/fusionRoute.test.ts       Includes the missing-modality regression test

services/pulmonary/        Python/FastAPI — pneumonia detection MOCK model
  main.py                  is_mock=True on every response, logged as a warning
  label_mapping.py         Raw label -> standardized finding taxonomy (section 5)
  test_pulmonary.py

services/fusion/           Python/FastAPI — concordance + confidence + forecast
  concordance.py           The core logic; unit tested in isolation from FastAPI
  main.py
  test_fusion.py
```

## What's real vs. mocked

- **Real:** the gateway orchestration, timeout handling, label-mapping pattern,
  concordance logic, confidence-discount rule, and forecast rule are all real,
  tested logic — this is the actual pipeline shape to build organs 2–7 against.
- **Mocked:** the pulmonary model itself (`run_inference` in `main.py`) is a
  deterministic stand-in, not a trained model. Every response it produces sets
  `is_mock: true` and logs a warning — this flag must keep propagating as real
  models replace mocks, so nobody mistakes a stub result for a real one later.

## Verified (this session)

- 11 Python tests pass (`pytest` in both `services/pulmonary` and `services/fusion`).
- 3 TypeScript tests pass (`vitest` in `gateway`), including the regression
  test that a missing image modality **lowers** `fusion_confidence` rather
  than leaving it unchanged.
- Full three-process stack actually booted and exercised over real HTTP:
  - Missing image → `concordance: "DISCORDANT"`, `fusion_confidence: 0`.
  - Image present → `concordance: "CONCORDANT"`, `fusion_confidence: 0.82`,
    a real `pneumonia` finding with `source_models` traceability, a risk
    index, and a 3-point forecast.

## Running it

**Locally:**
```bash
# terminal 1
cd services/pulmonary && pip install -r requirements.txt && uvicorn main:app --port 8001

# terminal 2
cd services/fusion && pip install -r requirements.txt && uvicorn main:app --port 8010

# terminal 3
cd gateway && npm install && npm run build && \
  PULMONARY_SERVICE_URL=http://localhost:8001 FUSION_SERVICE_URL=http://localhost:8010 \
  node dist/server.js
```

**Docker:**
```bash
docker compose up --build
```

**Test:**
```bash
cd services/pulmonary && pytest
cd services/fusion && pytest
cd gateway && npm test
```

**Try it:**
```bash
curl -X POST http://localhost:4000/api/fusion/infer \
  -H "Content-Type: application/json" \
  -d '{"patient_id":"PT-001","inputs":{"image":"ZmFrZS1pbWFnZS1kYXRh"}}'
```

## Known debt (intentional, flagged for Phase 3)

1. **Type duplication.** `gateway/src/types.ts`, `services/pulmonary/schemas.py`,
   and `services/fusion/schemas.py` all hand-mirror the same contract. Fine for
   one domain; before adding organ 2, extract a shared schema (OpenAPI codegen,
   or a small internal package) instead of copy-pasting a third time.
2. **Label mapping duplicated between pulmonary and fusion.** The fusion
   service currently owns its own copy of `LABEL_MAP` rather than importing
   from the pulmonary service (they're separate deployable services with no
   shared Python package yet). Same fix as #1 — a shared package resolves both.
3. **Concordance logic only handles one domain today.** The cross-system
   disagreement check in `concordance.py` is written but untested against a
   second domain, since there isn't one yet. When heart/brain services land,
   add explicit multi-domain concordance tests before trusting that branch.

## Next steps (Phase 1 → Phase 2)

- Replace `run_inference()` in `services/pulmonary/main.py` with a real model
  load. Nothing else needs to change — the contract is already decoupled.
- Wire the Next.js dashboard to call `/api/fusion/infer` and render the
  response (findings, concordance badge, risk index, forecast timeline).
- Build `XRayOrganViewer` (see the fusion/deployment spec, section 11) and
  connect `risk_index` / `fusion_confidence` from this API to its shader uniforms.
