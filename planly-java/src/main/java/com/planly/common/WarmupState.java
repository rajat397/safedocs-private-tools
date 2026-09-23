package com.planly.common;

import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Supabase-pause cold-start flag. Warm by default (startup warms); the daily
 * cron keeps it warm. Marked cold only on observed DB outage, in which case
 * /v1 serves 503 + Retry-After:20 with telemetry.
 */
public final class WarmupState {

  private static final AtomicBoolean COLD = new AtomicBoolean(false);
  private static final AtomicLong COLD_STARTS = new AtomicLong(0);

  private WarmupState() {
  }

  public static boolean isCold() {
    if ("true".equalsIgnoreCase(System.getenv("SUPABASE_PAUSED"))) {
      return true;
    }
    return COLD.get();
  }

  public static void markCold() {
    if (COLD.compareAndSet(false, true)) {
      COLD_STARTS.incrementAndGet();
    }
  }

  public static void markWarm() {
    COLD.set(false);
  }

  public static long coldStarts() {
    return COLD_STARTS.get();
  }

  /** Test/seam hook: force the cold path without env changes. */
  public static void setColdForTests(boolean cold) {
    COLD.set(cold);
  }
}
