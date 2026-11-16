// Auto-escalation service for SangamIQ.
// Checks for unaccepted requests exceeding timeout thresholds (30s for critical, 90s for others),
// widens the matching pool, marks the request 'escalated', and raises organiser alerts after 3 rounds.

import { listHelpRequests, escalateHelpRequest } from '../repos/requestsRepo.js';
import { createAlert } from '../repos/alertsRepo.js';

let workerInterval = null;

export async function checkEscalations(customThresholds = {}) {
  try {
    const unaccepted = await listHelpRequests({ status: 'open,escalated' });

    for (const req of unaccepted) {
      if (req.maxEscalated) continue;

      const criticalThreshold = customThresholds.critical || 30 * 1000;
      const normalThreshold = customThresholds.normal || 90 * 1000;
      const threshold = req.priority === 'critical' ? criticalThreshold : normalThreshold;

      const refTime = new Date(req.lastEscalatedAt || req.createdAt).getTime();
      const elapsed = Date.now() - refTime;

      if (elapsed >= threshold) {
        const nextRound = (req.escalationRound || 0) + 1;
        if (nextRound <= 3) {
          console.log(`⚠️  Auto-escalating request ${req.id} to round ${nextRound} (${req.priority})`);
          await escalateHelpRequest(req.id, nextRound);

          if (nextRound === 3) {
            console.log(`🚨 Request ${req.id} reached maximum escalation (3 rounds) with no volunteer taker!`);
            await createAlert({
              level: 'emergency',
              title: `Unattended ${req.priority} request (${req.type})`,
              message: `Request ${req.id} for ${req.type} has had no volunteer taker after 3 escalation rounds. Attendee directed to nearest help point.`,
              hi: `अनुरोध ${req.id} 3 दौर के बाद भी किसी स्वयंसेवक द्वारा स्वीकार नहीं किया गया है।`,
              mr: `विनंती ${req.id} 3 फेऱ्यांनंतरही कोणत्याही स्वयंसेवकाने स्वीकारली नाही.`,
              auto: true,
            });
          }
        }
      }
    }
  } catch (err) {
    console.warn('⚠️  Error during escalation check:', err.message);
  }
}

export function startEscalationWorker(intervalMs = 5000) {
  if (workerInterval) return;
  workerInterval = setInterval(() => checkEscalations(), intervalMs);
  console.log(`⚡ Auto-escalation worker active (polling every ${intervalMs / 1000}s)`);
}

export function stopEscalationWorker() {
  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
  }
}
