package com.planly.gen;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * DTO shape coverage for the generate/operation lane.
 */
class GenDtosTest {

  @Test
  void dtosShape() {
    GenDtos.GenerateAccepted accepted = new GenDtos.GenerateAccepted("op1", "accepted");
    assertThat(accepted.opId()).isEqualTo("op1");
    assertThat(accepted.status()).isEqualTo("accepted");
    GenDtos.OperationResponse response = new GenDtos.OperationResponse("op1",
        "succeeded", "d1", "p1", 1, null);
    assertThat(response.planVersion()).isEqualTo(1);
    assertThat(response.errorCode()).isNull();
  }
}
