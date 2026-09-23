package com.planly.gen;

import jakarta.validation.constraints.NotBlank;

/**
 * Generate/operation DTOs (Java records, canonical naming: opId).
 */
public final class GenDtos {

  private GenDtos() {
  }

  public record GenerateAccepted(@NotBlank String opId, @NotBlank String status) {
  }

  public record OperationResponse(@NotBlank String opId, @NotBlank String status,
      String draftId, String planId, Integer planVersion, String errorCode) {
  }
}
