// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Rajat Srivastava. Source-available - see /LICENSE. Commercial use requires permission: rajat242003@gmail.com.

import type { Rule } from './worker.ts';

interface Match {
  start: number;
  end: number;
  value: string;
}

export interface Finding {
  pattern: string;
  label: string;
  matches: Match[];
}

interface ScanRequest {
  text: string;
  customRules?: Rule[];
}

interface ScanResponse {
  findings: Finding[];
  error?: string;
}

let worker: Worker | null = null;
let pendingResolve: ((value: Finding[]) => void) | null = null;
let pendingReject: ((reason: Error) => void) | null = null;

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<ScanResponse>) => {
      const { findings, error } = event.data;
      if (error) {
        pendingReject?.(new Error(error));
      } else {
        pendingResolve?.(findings || []);
      }
      pendingResolve = null;
      pendingReject = null;
    };
    worker.onerror = (err) => {
      pendingReject?.(new Error(`Worker error: ${err.message}`));
      pendingResolve = null;
      pendingReject = null;
    };
  }
  return worker;
}

export async function scan(text: string, customRules?: Rule[]): Promise<Finding[]> {
  if (typeof text !== 'string') {
    throw new Error('scan() expects a string as first argument');
  }

  const w = getWorker();

  return new Promise((resolve, reject) => {
    pendingResolve = resolve;
    pendingReject = reject;
    w.postMessage({ text, customRules } as ScanRequest);
  });
}

export function terminate(): void {
  if (worker) {
    worker.terminate();
    worker = null;
  }
}

export { type Rule };