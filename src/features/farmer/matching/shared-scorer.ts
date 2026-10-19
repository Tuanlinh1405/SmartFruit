import { rankRequestMatches } from '../../matching/core';
import type { MatchScorer } from './farmer-matching';
// Adapt output only. All scoring and stable ordering come from B's shared core.
export const scoreFarmerRequests = ((lot, requests) =>
  rankRequestMatches(requests.map(request => ({ request })), lot, 'rule-only').map(result => ({
    lotId: lot.id, requestId: result.request.id, score: result.score,
    reasons: [result.nameMatch.reason, ...result.business.reasons], missingInformation: [], ruleVersion: result.ruleVersion,
    suggestedQuantityKg: result.business.contributionKg,
  }))) satisfies MatchScorer;
