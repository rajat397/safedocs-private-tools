package com.planly.plan;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

import com.planly.step.StepStore;

/**
 * Plan + readjustment memory lane (prod writes go only through the
 * rpc_plan_insert / rpc_readjust_append SQL functions in V3/V4, which enforce
 * immutability and append-only at the DB layer, including the
 * rpc_readjust_append idempotency-key uniqueness constraint). This class is
 * the SOLE Java writer of plan/readjustment rows — the SQL-function
 * equivalent for local/test single-JVM use only.
 *
 * <p>Test-only note: the {@code synchronized} writers below serialize
 * writers inside one JVM for tests and local dev. They are NOT the prod
 * concurrency control — prod relies on the DB constraints, so concurrent
 * writers on multiple instances cannot double-append.
 */
public final class PlanStore {

  public record PlanRecord(String id, String draftId, int version,
      Map<String, Object> teaser, Map<String, Object> full, long createdAt) {
  }

  public record Readjustment(String id, String planId, String draftId,
      int baseVersion, Map<String, Object> delta, String authorUserId,
      long createdAt) {
  }

  public record Replay(String readjustmentId, int baseVersion, String opId) {
  }

  private static final Map<String, PlanRecord> BY_ID = new ConcurrentHashMap<>();
  private static final Map<String, List<PlanRecord>> BY_DRAFT = new ConcurrentHashMap<>();
  private static final Map<String, Readjustment> READJUSTMENTS = new ConcurrentHashMap<>();
  private static final Map<String, Replay> REPLAYS = new ConcurrentHashMap<>();

  private PlanStore() {
  }

  /** Sole writer: materialise the next immutable plan version for a family. */
  public static synchronized PlanRecord materialise(String draftId, long now) {
    int version = headVersion(draftId) + 1;
    Map<String, Object> teaser = teaserFor(draftId);
    Map<String, Object> full = fullFor(draftId, version);
    PlanRecord plan = new PlanRecord(UUID.randomUUID().toString(), draftId,
        version, teaser, full, now);
    return insert(plan);
  }

  /** Sole writer: append a readjustment and materialise head+1. */
  public static synchronized PlanRecord appendReadjustment(String planId,
      String draftId, int baseVersion, Map<String, Object> delta,
      String authorUserId, String key, String opId, long now) {
    Replay existing = REPLAYS.get(draftId + ":" + key);
    if (existing != null) {
      return BY_ID.values().stream()
          .filter(p -> p.draftId().equals(draftId))
          .max(java.util.Comparator.comparingInt(PlanRecord::version))
          .orElse(null);
    }
    PlanRecord base = BY_ID.get(planId);
    Map<String, Object> teaser = base == null ? Map.of()
        : new LinkedHashMap<>(base.teaser());
    int version = headVersion(draftId) + 1;
    String newPlanId = UUID.randomUUID().toString();

    // Store readjustment FIRST so progress derivation sees it during fullFor
    String readjustmentId = UUID.randomUUID().toString();
    Map<String, Object> deltaCopy =
        Collections.unmodifiableMap(new LinkedHashMap<>(delta));
    READJUSTMENTS.put(readjustmentId, new Readjustment(readjustmentId, newPlanId,
        draftId, baseVersion, deltaCopy, authorUserId, now));
    REPLAYS.put(draftId + ":" + key,
        new Replay(readjustmentId, baseVersion, opId));

    // Now compute full (progress derivation will see the new readjustment)
    Map<String, Object> full = fullFor(draftId, version);
    PlanRecord next = new PlanRecord(newPlanId, draftId, version, teaser, full, now);
    return insert(next);
  }

  public static Replay replay(String draftId, String key) {
    return REPLAYS.get(draftId + ":" + key);
  }

  public static String readjustmentFor(String draftId, String key) {
    Replay replay = REPLAYS.get(draftId + ":" + key);
    return replay == null ? null : replay.readjustmentId();
  }

  public static void putReplay(String draftId, String key, Replay replay) {
    REPLAYS.put(draftId + ":" + key, replay);
  }

  private static PlanRecord insert(PlanRecord plan) {
    PlanRecord sealed = new PlanRecord(plan.id(), plan.draftId(), plan.version(),
        Collections.unmodifiableMap(new LinkedHashMap<>(plan.teaser())),
        plan.full() == null ? null
            : Collections.unmodifiableMap(new LinkedHashMap<>(plan.full())),
        plan.createdAt());
    BY_ID.put(sealed.id(), sealed);
    BY_DRAFT.computeIfAbsent(sealed.draftId(), k -> new ArrayList<>()).add(sealed);
    return sealed;
  }

  public static PlanRecord get(String planId) {
    return BY_ID.get(planId);
  }

  public static PlanRecord latest(String draftId) {
    List<PlanRecord> list = BY_DRAFT.get(draftId);
    if (list == null || list.isEmpty()) {
      return null;
    }
    PlanRecord best = list.get(0);
    for (PlanRecord plan : list) {
      if (plan.version() > best.version()) {
        best = plan;
      }
    }
    return best;
  }

  public static int headVersion(String draftId) {
    PlanRecord latest = latest(draftId);
    return latest == null ? 0 : latest.version();
  }

  public static Set<Integer> versions(String draftId) {
    List<PlanRecord> list = BY_DRAFT.get(draftId);
    Set<Integer> out = new java.util.HashSet<>();
    if (list != null) {
      for (PlanRecord plan : list) {
        out.add(plan.version());
      }
    }
    return out;
  }

  private static Map<String, Object> teaserFor(String draftId) {
    StepStore.StepRow step1 = StepStore.get(draftId, 1);
    Map<String, Object> teaser = new LinkedHashMap<>();
    teaser.put("title", "Plan");
    if (step1 != null && step1.payload().get("planName") instanceof String name
        && !name.isBlank()) {
      teaser.put("title", name);
    }
    teaser.put("stepCount", 1);
    return teaser;
  }

  private static Map<String, Object> fullFor(String draftId, int version) {
    Map<String, Object> metrics = new LinkedHashMap<>();
    metrics.put("totalSprints", 1);
    metrics.put("subjects", 1);
    metrics.put("studyHours", 1);
    metrics.put("planVersion", version);

    // Load track tasks from seed data
    List<Map<String, Object>> allTasks = StepStore.getAllTrackTasks();
    List<Map<String, Object>> sprints = buildSprints(allTasks);
    List<Map<String, Object>> dailies = allTasks.stream()
        .map(PlanStore::taskToDaily)
        .collect(Collectors.toList());

    // Build tracks array for full response
    List<Map<String, Object>> tracks = buildTracks(allTasks);

    // Progress: derive from completion deltas in readjustments
    Map<String, Object> progress = deriveProgress(draftId, dailies.size());
    metrics.put("progress", progress);

    StepStore.StepRow step1 = StepStore.get(draftId, 1);
    if (step1 != null) {
      metrics.put("step1", new LinkedHashMap<>(step1.payload()));
    }
    Map<String, Object> full = new LinkedHashMap<>();
    full.put("sprints", sprints);
    full.put("dailies", dailies);
    full.put("metrics", metrics);
    full.put("tracks", tracks);
    return full;
  }

  private static List<Map<String, Object>> buildTracks(List<Map<String, Object>> tasks) {
    // Group by track
    Map<String, List<Map<String, Object>>> byTrack = tasks.stream()
        .collect(Collectors.groupingBy(t -> (String) t.get("track"),
            LinkedHashMap::new, Collectors.toList()));

    return byTrack.entrySet().stream().map(e -> {
      Map<String, Object> track = new LinkedHashMap<>();
      track.put("id", e.getKey());
      track.put("title", e.getKey());
      track.put("levels", e.getValue().stream()
          .map(t -> t.get("level"))
          .distinct()
          .sorted()
          .collect(Collectors.toList()));
      track.put("sprints", e.getValue().stream()
          .map(t -> t.get("sprint"))
          .distinct()
          .sorted()
          .collect(Collectors.toList()));
      track.put("taskIds", e.getValue().stream()
          .map(t -> t.get("id"))
          .collect(Collectors.toList()));
      track.put("hireable_gate", e.getValue().get(0).get("hireable_gate"));
      return track;
    }).collect(Collectors.toList());
  }

  private static Map<String, Object> deriveProgress(String draftId, int totalTasks) {
    int done = 0;
    for (PlanStore.Readjustment r : READJUSTMENTS.values()) {
      if (r.draftId().equals(draftId)) {
        Map<String, Object> delta = r.delta();
        if (delta.containsKey("taskId") && delta.containsKey("confidence")) {
          done++;
        }
      }
    }
    return Map.of("done", done, "total", totalTasks);
  }

  private static List<Map<String, Object>> buildSprints(
      List<Map<String, Object>> tasks) {
    // Group by sprint
    Map<String, List<Map<String, Object>>> bySprint = tasks.stream()
        .collect(Collectors.groupingBy(t -> (String) t.get("sprint"),
            LinkedHashMap::new, Collectors.toList()));

    return bySprint.entrySet().stream().map(e -> {
      Map<String, Object> sprint = new LinkedHashMap<>();
      sprint.put("id", e.getKey());
      sprint.put("track", e.getValue().get(0).get("track"));
      sprint.put("level", e.getValue().get(0).get("level"));
      sprint.put("title", e.getValue().get(0).get("title"));
      sprint.put("taskIds", e.getValue().stream()
          .map(t -> t.get("id"))
          .collect(Collectors.toList()));
      return sprint;
    }).collect(Collectors.toList());
  }

  private static Map<String, Object> taskToDaily(Map<String, Object> t) {
    Map<String, Object> daily = new LinkedHashMap<>();
    daily.put("taskId", t.get("id"));
    daily.put("doing_verb", t.get("doing_verb"));
    daily.put("title", t.get("title"));
    daily.put("minutes", t.get("minutes"));
    daily.put("done_criteria", t.get("done_criteria"));
    daily.put("planly_check", t.get("planly_check"));
    daily.put("confidence", t.get("confidence"));
    daily.put("miss_rule", t.get("miss_rule"));
    return Collections.unmodifiableMap(daily);
  }

  public static void resetForTests() {
    BY_ID.clear();
    BY_DRAFT.clear();
    READJUSTMENTS.clear();
    REPLAYS.clear();
  }
}
