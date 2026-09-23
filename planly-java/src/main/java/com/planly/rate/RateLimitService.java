package com.planly.rate;

import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * In-memory sliding-window caps (single-instance lane; prod uses a shared
 * store). Every deny returns Retry-After seconds; callers map to 429.
 */
public final class RateLimitService {

  public static final int ANON_DRAFTS_PER_HOUR = 20;
  public static final int PUT_PER_IP_PER_MIN = 60;
  public static final int WRITES_PER_DRAFT_PER_HR = 60;
  public static final long GLOBAL_PER_DAY = 80_000L;

  private static final long HOUR_MS = 3600_000L;
  private static final long MIN_MS = 60_000L;
  private static final long DAY_MS = 24 * 3600_000L;

  private static final Map<String, Deque<Long>> ANON_BY_IP = new ConcurrentHashMap<>();
  private static final Map<String, Deque<Long>> PUT_BY_IP = new ConcurrentHashMap<>();
  private static final Map<String, Deque<Long>> WRITES_BY_DRAFT = new ConcurrentHashMap<>();
  private static final Deque<Long> GLOBAL = new ArrayDeque<>();

  private RateLimitService() {
  }

  public static long checkAnonDraft(String ip, long now) {
    return check(ANON_BY_IP, ip, ANON_DRAFTS_PER_HOUR, HOUR_MS, now);
  }

  public static long checkPutByIp(String ip, long now) {
    return check(PUT_BY_IP, ip, PUT_PER_IP_PER_MIN, MIN_MS, now);
  }

  public static long checkWritesByDraft(String draftId, long now) {
    return check(WRITES_BY_DRAFT, draftId, WRITES_PER_DRAFT_PER_HR, HOUR_MS, now);
  }

  public static long checkGlobalShed(long now) {
    synchronized (GLOBAL) {
      prune(GLOBAL, DAY_MS, now);
      if (GLOBAL.size() < GLOBAL_PER_DAY) {
        GLOBAL.addLast(now);
        return 0;
      }
      return retryAfter(GLOBAL.peekFirst(), DAY_MS, now);
    }
  }

  private static long check(Map<String, Deque<Long>> table, String key,
      long limit, long windowMs, long now) {
    Deque<Long> hits = table.computeIfAbsent(key, k -> new ArrayDeque<>());
    synchronized (hits) {
      prune(hits, windowMs, now);
      if (hits.size() < limit) {
        hits.addLast(now);
        return 0;
      }
      return retryAfter(hits.peekFirst(), windowMs, now);
    }
  }

  private static void prune(Deque<Long> hits, long windowMs, long now) {
    while (!hits.isEmpty() && now - hits.peekFirst() >= windowMs) {
      hits.pollFirst();
    }
  }

  private static long retryAfter(Long oldest, long windowMs, long now) {
    if (oldest == null) {
      return 1;
    }
    return Math.max(1, (oldest + windowMs - now + 999) / 1000);
  }

  /** Test seam: clear all counters between cases. */
  public static void resetForTests() {
    ANON_BY_IP.clear();
    PUT_BY_IP.clear();
    WRITES_BY_DRAFT.clear();
    synchronized (GLOBAL) {
      GLOBAL.clear();
    }
  }
}
