export function selectCoverageAwareVariant(candidates, attempts = [], rng = Math.random) {
  if (!Array.isArray(candidates) || candidates.length === 0) {
    throw new Error('Empty candidate list');
  }

  // Create exposure key: commandId\0phrasingId\0voiceId
  function exposureKey(attempt) {
    return `${attempt.commandId}\u0000${attempt.phrasingId}\u0000${attempt.voiceId}`;
  }

  // Count exposures per key (aggregate across speeds)
  const exposureCounts = new Map();
  for (const attempt of attempts) {
    const key = exposureKey(attempt);
    exposureCounts.set(key, (exposureCounts.get(key) || 0) + 1);
  }

  // Find minimum exposure among candidates
  let minExposure = Infinity;
  for (const candidate of candidates) {
    const key = `${candidate.commandId}\u0000${candidate.phrasingId}\u0000${candidate.voiceId}`;
    const count = exposureCounts.get(key) || 0;
    if (count < minExposure) {
      minExposure = count;
    }
  }

  // Filter candidates with minimum exposure
  const leastExposed = candidates.filter(candidate => {
    const key = `${candidate.commandId}\u0000${candidate.phrasingId}\u0000${candidate.voiceId}`;
    const count = exposureCounts.get(key) || 0;
    return count === minExposure;
  });

  // Select uniformly among tied candidates using injected RNG
  const index = Math.min(leastExposed.length - 1, Math.floor(rng() * leastExposed.length));
  const selected = leastExposed[index];

  // Return frozen copy
  return Object.freeze({ ...selected });
}
