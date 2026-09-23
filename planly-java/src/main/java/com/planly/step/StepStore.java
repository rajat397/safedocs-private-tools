package com.planly.step;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Step rows keyed by draftId:n plus the forward-only maxN pointer.
 * OCC is a single compare-and-set; no SELECT FOR UPDATE anywhere.
 * Also holds track seed tasks keyed by track:level.
 */
public final class StepStore {

  public record StepRow(String draftId, int n, Map<String, Object> payload,
      int version, long updatedAt) {
  }

  private static final Map<String, StepRow> STEPS = new ConcurrentHashMap<>();
  private static final Map<String, Integer> MAX_N = new ConcurrentHashMap<>();

  // Track seed tasks: key = "track:level" -> list of task maps
  private static final Map<String, List<Map<String, Object>>> TRACK_TASKS = new ConcurrentHashMap<>();

  private StepStore() {
  }

  static String key(String draftId, int n) {
    return draftId + ":" + n;
  }

  public static StepRow get(String draftId, int n) {
    return STEPS.get(key(draftId, n));
  }

  public static int maxN(String draftId) {
    int memo = MAX_N.getOrDefault(draftId, 1);
    int saved = 0;
    for (StepRow row : STEPS.values()) {
      if (row.draftId().equals(draftId) && row.n() > saved) {
        saved = row.n();
      }
    }
    return Math.min(Math.max(1, Math.max(memo, saved)), 6);
  }

  /**
   * Single-statement OCC put: exactly one atomic compare-and-set per attempt
   * ({@code putIfAbsent} for inserts, {@code replace(key, current, next)} for
   * updates). Lost races retry the read-and-CAS loop; a version mismatch
   * returns null. Payloads are defensively copied on insert.
   */
  public static StepRow put(String draftId, int n, Map<String, Object> payload,
      int expectedVersion, long now) {
    Map<String, Object> safe = payload == null ? Map.of()
        : Collections.unmodifiableMap(new LinkedHashMap<>(payload));
    for (int attempt = 0; attempt < 8; attempt++) {
      String key = key(draftId, n);
      StepRow current = STEPS.get(key);
      int currentVersion = current == null ? 1 : current.version();
      if (expectedVersion != currentVersion) {
        return null;
      }
      StepRow next = new StepRow(draftId, n, safe, currentVersion + 1, now);
      boolean stored = current == null
          ? STEPS.putIfAbsent(key, next) == null
          : STEPS.replace(key, current, next);
      if (stored) {
        MAX_N.merge(draftId, n, Math::max);
        return next;
      }
    }
    return null;
  }

  public static boolean hasPayload(String draftId, int n) {
    StepRow row = get(draftId, n);
    return row != null && row.payload() != null && !row.payload().isEmpty();
  }

  /** Store track seed tasks for a (track, level) pair. */
  public static void putTrackTask(String track, String level, Map<String, Object> task) {
    String key = track + ":" + level;
    TRACK_TASKS.computeIfAbsent(key, k -> Collections.synchronizedList(new java.util.ArrayList<>()))
        .add(Collections.unmodifiableMap(new LinkedHashMap<>(task)));
  }

  /** Retrieve all track tasks for a (track, level) pair. */
  public static List<Map<String, Object>> getTrackTasks(String track, String level) {
    String key = track + ":" + level;
    List<Map<String, Object>> list = TRACK_TASKS.get(key);
    return list == null ? List.of() : List.copyOf(list);
  }

  /** Retrieve all track tasks across all tracks/levels. */
  public static List<Map<String, Object>> getAllTrackTasks() {
    List<Map<String, Object>> all = new java.util.ArrayList<>();
    for (List<Map<String, Object>> list : TRACK_TASKS.values()) {
      all.addAll(list);
    }
    return List.copyOf(all);
  }

  public static void resetForTests() {
    STEPS.clear();
    MAX_N.clear();
    TRACK_TASKS.clear();
  }
}
