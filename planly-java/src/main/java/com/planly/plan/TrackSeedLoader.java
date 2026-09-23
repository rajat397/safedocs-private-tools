package com.planly.plan;

import com.planly.step.StepStore;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.json.BasicJsonParser;
import org.springframework.boot.json.JsonParser;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import java.io.InputStream;
import java.util.List;
import java.util.Map;

/**
 * Loads hireable tracks from classpath JSON at startup.
 * Asserts 75 tasks, 5 tracks x 5 levels, 25 sprints.
 * Fails fast if seed is missing or malformed.
 */
@Component
public class TrackSeedLoader {

  private static final Logger log = LoggerFactory.getLogger(TrackSeedLoader.class);
  private static final String SEED_PATH = "planly/tracks-hireable-v2.json";
  private static final int EXPECTED_TASKS = 75;
  private static final int EXPECTED_TRACKS = 5;
  private static final int EXPECTED_LEVELS = 5;
  private static final int EXPECTED_SPRINTS = 25;

  private final JsonParser parser = new BasicJsonParser();

  @PostConstruct
  public void load() {
    try (InputStream is = new ClassPathResource(SEED_PATH).getInputStream()) {
      String json = new String(is.readAllBytes(), java.nio.charset.StandardCharsets.UTF_8);
      @SuppressWarnings("unchecked")
      List<Object> rawTasks = parser.parseList(json);
      List<Map<String, Object>> tasks = rawTasks.stream()
          .map(o -> (Map<String, Object>) o)
          .toList();

      if (tasks.size() != EXPECTED_TASKS) {
        throw new IllegalStateException(
            "Seed task count mismatch: expected " + EXPECTED_TASKS + ", got " + tasks.size());
      }

      // Validate required keys per task
      for (Map<String, Object> t : tasks) {
        validateTask(t);
      }

      // Group by track:level -> sprint
      Map<String, List<Map<String, Object>>> bySprint = new java.util.LinkedHashMap<>();
      for (Map<String, Object> t : tasks) {
        String sprint = (String) t.get("sprint");
        if (sprint == null || sprint.isBlank()) {
          throw new IllegalStateException("Task missing sprint: " + t.get("id"));
        }
        bySprint.computeIfAbsent(sprint, k -> new java.util.ArrayList<>()).add(t);
      }

      if (bySprint.size() != EXPECTED_SPRINTS) {
        throw new IllegalStateException(
            "Sprint count mismatch: expected " + EXPECTED_SPRINTS + ", got " + bySprint.size());
      }

      // Load into StepStore
      for (Map<String, Object> t : tasks) {
        StepStore.putTrackTask(
            (String) t.get("track"),
            (String) t.get("level"),
            t
        );
      }

      log.info("Track seed loaded: {} tasks, {} sprints, {} tracks x {} levels",
          tasks.size(), bySprint.size(), EXPECTED_TRACKS, EXPECTED_LEVELS);

    } catch (Exception e) {
      throw new IllegalStateException("Failed to load track seed: " + SEED_PATH, e);
    }
  }

  private void validateTask(Map<String, Object> t) {
    String[] required = {"id", "title", "url", "type", "difficulty", "tags",
        "upstream_stars", "license_note", "attribution", "track", "origin",
        "minutes", "doing_verb", "done_criteria", "planly_check", "miss_rule",
        "level", "sprint"};
    for (String key : required) {
      if (!t.containsKey(key) || t.get(key) == null) {
        throw new IllegalStateException("Task missing required key '" + key + "': " + t.get("id"));
      }
    }
    // Validate confidence range if present
    Object conf = t.get("confidence");
    if (conf instanceof Number n) {
      int v = n.intValue();
      if (v < 1 || v > 5) {
        throw new IllegalStateException("Confidence out of range 1-5: " + t.get("id"));
      }
    }
    // Validate minutes range
    Object min = t.get("minutes");
    if (min instanceof Number n) {
      int v = n.intValue();
      if (v < 15 || v > 45) {
        throw new IllegalStateException("Minutes out of range 15-45: " + t.get("id"));
      }
    }
  }

  /** Validation entry point for CI/scripts. */
  public static void validateSeed() {
    new TrackSeedLoader().load();
  }
}