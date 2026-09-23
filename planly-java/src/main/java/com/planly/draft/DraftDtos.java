package com.planly.draft;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;

/**
 * Draft lane DTOs (Java records, Bean-Validation ready).
 */
public final class DraftDtos {

  private DraftDtos() {
  }

  public record DraftResponse(@NotBlank String id, @Min(1) int version,
      @NotBlank String status) {
  }

  public record BindResponse(@NotBlank String id, String ownerUserId,
      boolean merged) {
  }

  public record DiscardResponse(@NotBlank String id, @NotBlank String status) {
  }
}
