/** Spike measurement and stop-rule helpers (Sprint 14 Task 2, TD-023).
 *
 * Lives in a test-side module so the stop-rule revert of
 * tests/conformance/webgl1-harness.ts stays clean. Pure functions only;
 * no renderer or vendor dependencies.
 */

export interface ScriptDescriptor {
  code: string;
  filename: string;
  isExternal: boolean;
  src?: string;
}

export interface SpikeMeasurementDelta {
  suite: 'webgl1' | 'webgl2';
  baselinePassed: number;
  postSpikePassed: number;
  totalExecuted: number;
  deltaCount: number;
  deltaPercentagePoints: string;
  gateTarget: number;
  gateVerdict: 'PASS' | 'GAP_RECORDED';
  liftAchieved: boolean;
}

export type SpikeVerdict = 'NO_LIFT_STOP' | 'LIFT_RECORDED_INTERIM_GAPS_REMAIN' | 'INTERIM_GATES_MET';

/** Computes the percentage-point delta of a post-spike run vs the v5 baseline. */
export function computeSpikeDelta(
  suite: 'webgl1' | 'webgl2',
  baselinePassed: number,
  postSpikePassed: number,
  totalExecuted: number,
): SpikeMeasurementDelta {
  const deltaCount = postSpikePassed - baselinePassed;
  const points = totalExecuted > 0 ? (deltaCount / totalExecuted) * 100 : 0;
  const sign = points >= 0 ? '+' : '-';
  const absStr = Math.abs(points).toFixed(2);
  const gateTarget = suite === 'webgl1' ? 80 : 50;
  const postRate = totalExecuted > 0 ? (postSpikePassed / totalExecuted) * 100 : 0;
  const gateVerdict: 'PASS' | 'GAP_RECORDED' = postRate >= gateTarget ? 'PASS' : 'GAP_RECORDED';
  return {
    suite,
    baselinePassed,
    postSpikePassed,
    totalExecuted,
    deltaCount,
    deltaPercentagePoints: `${sign}${absStr}%`,
    gateTarget,
    gateVerdict,
    liftAchieved: deltaCount > 0,
  };
}

/** ADR-006 stop rule: zero lift on both suites halts CTS-chasing. */
export function evaluateStopRule(webgl1Delta: number, webgl2Delta: number): SpikeVerdict {
  if (webgl1Delta <= 0 && webgl2Delta <= 0) {
    return 'NO_LIFT_STOP';
  }
  return 'LIFT_RECORDED_INTERIM_GAPS_REMAIN';
}

/** Reverts non-lifting harness changes; executor is injectable for unit tests. */
export function revertNonLiftingChanges(executor?: (cmd: string) => unknown): unknown {
  const run = executor ?? (() => 0);
  return run('git checkout tests/conformance/webgl1-harness.ts');
}

/** Scope guard: zero files under src/ may be modified by the spike. */
export function verifyZeroSrcModified(files: string[]): { zeroSrcModified: boolean; violations: string[] } {
  const violations = (files ?? []).filter((f) => f.startsWith('src/'));
  return { zeroSrcModified: violations.length === 0, violations };
}
