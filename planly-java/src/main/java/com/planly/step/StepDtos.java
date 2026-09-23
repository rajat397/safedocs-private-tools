package com.planly.step;

import java.util.Map;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

/**
 * Step lane DTOs (Java records).
 */
public final class StepDtos {

  private StepDtos() {
  }

  public record StepResponse(@Min(1) @Max(6) int n,
      @NotNull Map<String, Object> payload, @Min(1) int version) {
  }

  public record PutResponse(@Min(1) @Max(6) int n, @Min(1) int version,
      @Min(1) @Max(6) int maxN) {
  }
}
