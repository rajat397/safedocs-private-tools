package com.planly.step;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Unit coverage for ETag helpers, If-Match parsing and body-size estimation.
 */
class StepControllerStaticsTest {

  @Test
  void etagHelpers() {
    assertThat(StepController.etag(2)).isEqualTo("\"v2\"");
    assertThat(StepController.etagMatches("\"v2\"", "\"v2\"")).isTrue();
    assertThat(StepController.etagMatches("v2", "\"v2\"")).isTrue();
    assertThat(StepController.etagMatches("\"v3\"", "\"v2\"")).isFalse();
    assertThat(StepController.etagMatches(null, "\"v2\"")).isFalse();
  }

  @Test
  void parseIfMatch() {
    assertThat(StepController.parseIfMatch("\"v2\"")).isEqualTo(2);
    assertThat(StepController.parseIfMatch("2")).isEqualTo(2);
    assertThat(StepController.parseIfMatch("\"V3\"")).isEqualTo(3);
    assertThat(StepController.parseIfMatch(null)).isNull();
    assertThat(StepController.parseIfMatch("nope")).isNull();
    assertThat(StepController.parseIfMatch("0")).isNull();
  }

  @Test
  void serialisedBytesShapes() {
    assertThat(StepController.serialisedBytes(null)).isPositive();
    assertThat(StepController.serialisedBytes(Map.of())).isPositive();
    assertThat(StepController.serialisedBytes(Map.of("a", "x"))).isPositive();
    int nested = StepController.serialisedBytes(
        Map.of("list", new java.util.ArrayList<>(java.util.Arrays.asList("a", 1, null)),
            "map", Map.of("k", "v"), "n", 7));
    assertThat(nested)
        .isGreaterThan(StepController.serialisedBytes(Map.of("a", "x")));
  }

  @Test
  void serialisedBytesExtras() {
    assertThat(StepController.serialisedBytes(Map.of("k", 1.5))).isPositive();
    assertThat(StepController.serialisedBytes(Map.of("k", false))).isPositive();
    assertThat(StepController.serialisedBytes(Map.of("k", new java.util.ArrayList<>())))
        .isPositive();
    assertThat(StepController.serialisedBytes(new java.util.LinkedHashMap<>()))
        .isPositive();
    assertThat(StepController.serialisedBytes(Map.of("k", Map.of("n", List.of(1)))))
        .isPositive();
  }

  @Test
  void dtosShape() {
    StepDtos.StepResponse step = new StepDtos.StepResponse(1, Map.of("a", 1), 2);
    assertThat(step.n()).isEqualTo(1);
    assertThat(new StepDtos.PutResponse(1, 2, 1).maxN()).isEqualTo(1);
  }
}
