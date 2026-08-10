/**
 * Confusion pairs are derived entirely from data attempts already record —
 * `selectedResult` (what the learner actually picked) and `expectedResult`
 * (what the command wanted), both stamped on every surfaced attempt in
 * training.js. No new tracking or schema migration is needed: an incorrect
 * attempt whose selectedResult happens to be a *different real command's*
 * actionId already tells us exactly which two actions got mixed up.
 */
export function computeConfusionPairs(attempts, commands) {
  if (!Array.isArray(attempts)) throw new Error('Invalid attempts');
  if (!Array.isArray(commands)) throw new Error('Invalid commands');
  const actionIds = new Set(commands.map(command => command.actionId));
  const pairsByKey = new Map();
  const order = [];
  for (const attempt of attempts) {
    if (attempt?.outcome !== 'incorrect') continue;
    const expected = attempt.expectedResult;
    const selected = attempt.selectedResult;
    if (!expected || !selected || expected === selected) continue;
    if (!actionIds.has(expected) || !actionIds.has(selected)) continue;
    const key = [expected, selected].sort().join('|');
    if (!pairsByKey.has(key)) {
      pairsByKey.set(key, { actionIdA: expected, actionIdB: selected, count: 0 });
      order.push(key);
    }
    pairsByKey.get(key).count += 1;
  }
  const pairs = order.map(key => Object.freeze({ ...pairsByKey.get(key) }));
  pairs.sort((a, b) => b.count - a.count);
  return Object.freeze(pairs);
}

/**
 * Walks confusion pairs in rank order, pulling in one command per involved
 * action (deduplicated) until `limit` is reached, so the most-confused pairs
 * are drilled first. Returns an empty array when there's no confusion
 * history yet — callers should treat that as "challenge not available yet",
 * not an error.
 */
export function confusionDrillCommandIds(pairs, commands, limit) {
  if (!Array.isArray(pairs)) throw new Error('Invalid confusion pairs');
  if (!Array.isArray(commands)) throw new Error('Invalid commands');
  if (!Number.isSafeInteger(limit) || limit < 1) throw new Error('Invalid confusion drill limit');
  const commandByActionId = new Map();
  for (const command of commands) {
    if (!commandByActionId.has(command.actionId)) commandByActionId.set(command.actionId, command);
  }
  const ids = [];
  const seen = new Set();
  outer: for (const pair of pairs) {
    for (const actionId of [pair.actionIdA, pair.actionIdB]) {
      const command = commandByActionId.get(actionId);
      if (!command || seen.has(command.id)) continue;
      seen.add(command.id);
      ids.push(command.id);
      if (ids.length >= limit) break outer;
    }
  }
  return Object.freeze(ids);
}
