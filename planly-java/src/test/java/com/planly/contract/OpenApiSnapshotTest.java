package com.planly.contract;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * RED: the served spec is not published yet, so byte-equality fails.
 * GREEN will require {@code src/main/resources/static/openapi.yaml} to be a
 * byte-exact copy of the frozen {@code contracts/openapi.yaml} reference.
 */
class OpenApiSnapshotTest {

  private static final Path FROZEN = Paths.get("contracts/openapi.yaml");
  private static final Path SERVED = Paths.get("src/main/resources/static/openapi.yaml");

  @Test
  void servedSpecByteEqualsFrozenContract() throws Exception {
    assertTrue(Files.exists(FROZEN), "frozen reference missing: " + FROZEN.toAbsolutePath());
    assertTrue(Files.exists(SERVED),
        "RED (intended): served spec not yet published at " + SERVED.toAbsolutePath());
    assertArrayEquals(Files.readAllBytes(FROZEN), Files.readAllBytes(SERVED),
        "served openapi.yaml drifted from frozen contract");
  }
}
