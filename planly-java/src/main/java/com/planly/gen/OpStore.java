package com.planly.gen;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

/**
 * Operation tracker (prod persists via Flyway V2 + RPCs). Accepted ops run
 * accepted -&gt; running -&gt; succeeded on a daemon scheduler; TTL is 24h,
 * after which GET serves 410 OP_GONE and the row is purged.
 */
public final class OpStore {

  public static final long TTL_MS = 24L * 3600 * 1000;

  public record Operation(String opId, String draftId, String key, String status,
      String planId, Integer planVersion, String errorCode,
      long createdAt, long updatedAt) {
    Operation with(String status, String planId, Integer planVersion,
        String error, long now) {
      return new Operation(opId, draftId, key, status, planId, planVersion,
          error, createdAt, now);
    }
  }

  public sealed interface Live permits Live.Found, Live.Expired, Live.Missing {
    record Found(Operation op) implements Live {
    }

    record Expired() implements Live {
    }

    record Missing() implements Live {
    }
  }

  private static final Map<String, Operation> BY_ID = new ConcurrentHashMap<>();
  private static final Map<String, String> BY_KEY = new ConcurrentHashMap<>();
  private static ScheduledExecutorService scheduler;

  private OpStore() {
  }

  private static synchronized ScheduledExecutorService pool() {
    if (scheduler == null || scheduler.isShutdown()) {
      scheduler = Executors.newSingleThreadScheduledExecutor(r -> {
        Thread thread = new Thread(r, "planly-ops");
        thread.setDaemon(true);
        return thread;
      });
    }
    return scheduler;
  }

  public static Live byKey(String draftId, String key, long now) {
    String opId = BY_KEY.get(draftId + ":" + key);
    if (opId == null) {
      return new Live.Missing();
    }
    return byId(opId, now);
  }

  public static Live byId(String opId, long now) {
    Operation op = BY_ID.get(opId);
    if (op == null) {
      return new Live.Missing();
    }
    if (op.createdAt() + TTL_MS <= now) {
      expire(op);
      return new Live.Expired();
    }
    return new Live.Found(op);
  }

  public static Operation create(String draftId, String key, long now,
      Runnable finisher) {
    Operation op = new Operation(UUID.randomUUID().toString(), draftId, key,
        "accepted", null, null, null, now, now);
    BY_ID.put(op.opId(), op);
    BY_KEY.put(draftId + ":" + key, op.opId());
    ScheduledExecutorService pool = pool();
    pool.schedule(() -> transition(op.opId(), "running", now), 60,
        TimeUnit.MILLISECONDS);
    pool.schedule(() -> {
      try {
        finisher.run();
      } catch (Exception e) {
        fail(op.opId(), "INTERNAL", System.currentTimeMillis());
      }
    }, 250, TimeUnit.MILLISECONDS);
    return op;
  }

  public static void complete(String opId, String planId, int planVersion, long now) {
    transitionTo(opId, "succeeded", planId, planVersion, null, now);
  }

  public static void fail(String opId, String errorCode, long now) {
    transitionTo(opId, "failed", null, null, errorCode, now);
  }

  private static void transition(String opId, String status, long startMs) {
    Operation current = BY_ID.get(opId);
    if (current == null || !"accepted".equals(current.status())) {
      return;
    }
    BY_ID.replace(opId, current,
        current.with(status, null, null, null, startMs + 60));
  }

  private static void transitionTo(String opId, String status, String planId,
      Integer planVersion, String error, long now) {
    Operation current = BY_ID.get(opId);
    if (current == null) {
      return;
    }
    BY_ID.replace(opId, current,
        current.with(status, planId, planVersion, error, now));
  }

  private static void expire(Operation op) {
    BY_ID.remove(op.opId(), op);
    BY_KEY.remove(op.draftId() + ":" + op.key(), op.opId());
  }

  public static int purgeExpired(long now) {
    int removed = 0;
    for (Map.Entry<String, Operation> entry : BY_ID.entrySet()) {
      Operation op = entry.getValue();
      if (op.createdAt() + TTL_MS <= now && BY_ID.remove(entry.getKey(), op)) {
        BY_KEY.remove(op.draftId() + ":" + op.key(), op.opId());
        removed++;
      }
    }
    return removed;
  }

  public static void resetForTests() {
    BY_ID.clear();
    BY_KEY.clear();
  }
}
