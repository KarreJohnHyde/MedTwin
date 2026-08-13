import { NextResponse } from "next/server";
import { FusionInferRequest, FusionInferResponse } from "../../../../types/fusion";

const PULMONARY_SERVICE_URL = process.env.PULMONARY_SERVICE_URL || "http://127.0.0.1:8001";
const FUSION_SERVICE_URL = process.env.FUSION_SERVICE_URL || "http://127.0.0.1:8000";

const DOMAIN_TIMEOUT_MS = 5000;

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

export async function POST(req: Request) {
  try {
    const body: FusionInferRequest = await req.json();

    // 1. Fan-out to domain services in parallel
    const fetchDomain = async (domainName: string, url: string) => {
      try {
        const res = await fetchWithTimeout(`${url}/infer`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }, DOMAIN_TIMEOUT_MS);

        if (!res.ok) {
           return { [domainName]: { error: `HTTP ${res.status}` } };
        }

        const data = await res.json();
        return { [domainName]: data }; // Assuming data matches DomainResponse
      } catch (err: any) {
        if (err.name === 'AbortError') {
           return { [domainName]: { error: 'invalid_input', detail: 'timeout' } };
        }
        return { [domainName]: { error: 'invalid_input', detail: err.message } };
      }
    };

    const domainPromises = [
      fetchDomain("pulmonary", PULMONARY_SERVICE_URL),
    ];

    const domainResultsArray = await Promise.all(domainPromises);
    const domainOutputs = Object.assign({}, ...domainResultsArray);

    // 2. Call the Fusion Service
    const fusionPayload = {
      patient_id: body.patient_id,
      inputs: body.inputs,
      domain_outputs: domainOutputs,
    };

    const fusionRes = await fetchWithTimeout(`${FUSION_SERVICE_URL}/fuse`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fusionPayload),
    }, DOMAIN_TIMEOUT_MS);

    if (!fusionRes.ok) {
      return NextResponse.json(
        { error: `Fusion service returned HTTP ${fusionRes.status}` },
        { status: 500 }
      );
    }

    const fusionData: FusionInferResponse = await fusionRes.json();
    return NextResponse.json(fusionData);

  } catch (error: any) {
    console.error("Fusion Gateway Error:", error);
    return NextResponse.json({ error: "Internal Server Error", details: error.message }, { status: 500 });
  }
}
