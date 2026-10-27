// client/src/test/fixtures/ids.ts — stable ids and timestamps shared by every fixture
// Session 43 · Build 5 · wave 5-0
//
// Request schemas use z.string().uuid() for asset, campaign, vote and batch
// ids, so fixtures use valid v4-shaped UUIDs; a test that sends fixture ids
// back to the API passes request validation in mockApi.

/** "Now" for every fixture timestamp (freeze time to this in relative-time tests). */
export const FIXTURE_NOW = '2026-10-24T08:00:00.000Z';

/** ISO timestamp `hours` before FIXTURE_NOW. */
export function hoursAgo(hours: number): string {
  return new Date(Date.parse(FIXTURE_NOW) - hours * 3_600_000).toISOString();
}

export const IDS = {
  users: {
    priya: 'priya.raman@example.com',
    jordan: 'jordan.lee@example.com',
    ana: 'ana.duarte@example.com',
    sam: 'sam.okafor@example.com',
    wei: 'wei.chen@example.com',
  },
  assets: {
    readmissionRate: '0b0e7c1a-5d2f-4a8e-9c3b-1a2b3c4d5e01',
    dischargeDisposition: '0b0e7c1a-5d2f-4a8e-9c3b-1a2b3c4d5e02',
    lengthOfStay: '0b0e7c1a-5d2f-4a8e-9c3b-1a2b3c4d5e03',
  },
  campaigns: {
    q4ClinicalQuality: '6c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e01',
  },
  synonyms: {
    readmits30d: '7d2e3f4a-5b6c-4d7e-8f9a-0b1c2d3e4f01',
    readmitRate: '7d2e3f4a-5b6c-4d7e-8f9a-0b1c2d3e4f02',
    bounceBack: '7d2e3f4a-5b6c-4d7e-8f9a-0b1c2d3e4f03',
  },
  examples: {
    heartFailure: '8e3f4a5b-6c7d-4e8f-9a0b-1c2d3e4f5a01',
    units: '8e3f4a5b-6c7d-4e8f-9a0b-1c2d3e4f5a02',
  },
  votes: {
    approve: '9f4a5b6c-7d8e-4f9a-8b1c-2d3e4f5a6b01',
    editAna: '9f4a5b6c-7d8e-4f9a-8b1c-2d3e4f5a6b02',
    editSam: '9f4a5b6c-7d8e-4f9a-8b1c-2d3e4f5a6b03',
  },
  skips: {
    first: 'a05b6c7d-8e9f-4a0b-9c2d-3e4f5a6b7c01',
  },
  batches: {
    proposed: 'b16c7d8e-9f0a-4b1c-8d3e-4f5a6b7c8d01',
    inReview: 'b16c7d8e-9f0a-4b1c-8d3e-4f5a6b7c8d02',
    failed: 'b16c7d8e-9f0a-4b1c-8d3e-4f5a6b7c8d03',
  },
  notifications: {
    certified: 'c27d8e9f-0a1b-4c2d-9e4f-5a6b7c8d9e01',
    branchReady: 'c27d8e9f-0a1b-4c2d-9e4f-5a6b7c8d9e02',
  },
  sources: {
    gitFolder: 'd38e9f0a-1b2c-4d3e-8f5a-6b7c8d9e0f01',
  },
} as const;

export const TARGET_CATALOG = 'hls_fde_dev';
export const TARGET_SCHEMA = 'dev_matthew_giglia_semantic_ground_truth';
