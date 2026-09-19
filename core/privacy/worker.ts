// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Rajat Srivastava. Source-available - see /LICENSE. Commercial use requires permission: rajat242003@gmail.com.

interface Rule {
  pattern: string;
  label: string;
}

interface ScanRequest {
  text: string;
  customRules?: Rule[];
}

interface Match {
  start: number;
  end: number;
  value: string;
}

interface Finding {
  pattern: string;
  label: string;
  matches: Match[];
}

interface ScanResponse {
  findings: Finding[];
  error?: string;
}

let cachedRules: Rule[] = [];

async function loadDefaultRules(): Promise<Rule[]> {
  if (cachedRules.length > 0) return cachedRules;
  try {
    const response = await fetch(new URL('rules.json', import.meta.url));
    if (!response.ok) throw new Error(`Failed to load rules: ${response.status}`);
    const data = await response.json();
    cachedRules = data.rules || [];
    return cachedRules;
  } catch (e) {
    console.error('[privacy-worker] Failed to load default rules:', e);
    return [];
  }
}

function compileRegex(pattern: string): RegExp {
  try {
    return new RegExp(pattern, 'g');
  } catch {
    return new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
  }
}

function scanText(text: string, rules: Rule[]): Finding[] {
  const findings: Finding[] = [];
  for (const rule of rules) {
    const regex = compileRegex(rule.pattern);
    const matches: Match[] = [];
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      matches.push({
        start: match.index,
        end: match.index + match[0].length,
        value: match[0],
      });
      if (!regex.global) break;
    }
    if (matches.length > 0) {
      findings.push({
        pattern: rule.pattern,
        label: rule.label,
        matches,
      });
    }
  }
  return findings;
}

self.onmessage = async (event: MessageEvent<ScanRequest>) => {
  const { text, customRules } = event.data;
  if (typeof text !== 'string') {
    const response: ScanResponse = { findings: [], error: 'Invalid input: text must be a string' };
    self.postMessage(response);
    return;
  }

  const defaultRules = await loadDefaultRules();
  const allRules = customRules ? [...defaultRules, ...customRules] : defaultRules;
  const findings = scanText(text, allRules);

  const response: ScanResponse = { findings };
  self.postMessage(response);
};

export {};