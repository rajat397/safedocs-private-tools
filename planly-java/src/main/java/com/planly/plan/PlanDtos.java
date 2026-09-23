package com.planly.plan;

import java.util.List;
import java.util.Map;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/**
 * Plan/readjustment DTOs (Java records, canonical naming).
 */
public final class PlanDtos {

  private PlanDtos() {
  }

  public record PlanResponse(@NotBlank String id, @Min(1) int version,
      @NotNull Map<String, Object> teaser, Map<String, Object> full) {
  }

  public record ReadjustAccepted(@NotBlank String readjustmentId,
      @Min(1) int baseVersion, @NotBlank String opId) {
  }

  public record DailyTask(@NotBlank String taskId, String doing_verb,
      @NotBlank String title, @Min(1) Integer minutes,
      @NotBlank String done_criteria, String planly_check,
      @Min(1) @Max(5) Integer confidence, String miss_rule) {
  }

  public record ResourceRef(@NotBlank String url, String attribution,
      String license_note) {
  }

  public record Track(@NotBlank String id, @NotBlank String title,
      @NotBlank String level, String sprint, List<String> taskIds) {
  }

  public record PlanProgress(@Min(0) int done, @Min(0) int total) {
  }
}
