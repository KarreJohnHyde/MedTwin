import { Router, type Request, type Response } from 'express';
import { callDomainService } from '../services/domainClient.js';
import type { DomainModelResult, FusionInferRequest, FusionInferResponse } from '../types.js';

const PULMONARY_URL = process.env.PULMONARY_SERVICE_URL ?? 'http://localhost:8001';
const FUSION_URL = process.env.FUSION_SERVICE_URL ?? 'http://localhost:8010';
const TIMEOUT_MS = Number(process.env.DOMAIN_CALL_TIMEOUT_MS ?? 5000);

export const fusionRouter = Router();

fusionRouter.post('/api/fusion/infer', async (req: Request, res: Response) => {
  const body = req.body as Partial<FusionInferRequest>;

  if (!body?.patient_id || !body?.inputs) {
    return res.status(400).json({ error: 'patient_id and inputs are required' });
  }

  // Phase 0/1: only the pulmonary domain is wired. Fan-out to more organs is
  // additive — add one callDomainService(...) entry per organ, in parallel,
  // never sequentially (section 7).
  const domainCalls: Promise<DomainModelResult>[] = [];

  if (body.inputs.image) {
    domainCalls.push(
      callDomainService(
        PULMONARY_URL,
        'pulmonary.pneumonia_detection',
        { image: body.inputs.image, image_modality: body.inputs.image_modality ?? null },
        TIMEOUT_MS
      )
    );
  } else {
    // No image supplied at all — this is a missing modality, not a silently
    // skipped one. Record it explicitly so fusion confidence gets discounted.
    domainCalls.push(
      Promise.resolve({ model_id: 'pulmonary.pneumonia_detection', status: 'invalid_input' })
    );
  }

  const domainResults = await Promise.all(domainCalls);

  try {
    const fusionRes = await fetch(`${FUSION_URL}/fuse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patient_id: body.patient_id, domain_results: domainResults }),
    });

    if (!fusionRes.ok) {
      return res.status(502).json({ error: 'Fusion service error', detail: await fusionRes.text() });
    }

    const fused = (await fusionRes.json()) as FusionInferResponse;
    return res.json(fused);
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});
