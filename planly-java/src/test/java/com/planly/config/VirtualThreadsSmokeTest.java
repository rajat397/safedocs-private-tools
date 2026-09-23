package com.planly.config;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * RED: no {@code application.properties/yaml} sets the virtual-threads flag yet.
 * GREEN will require {@code spring.threads.virtual.enabled=true} in main resources.
 */
class VirtualThreadsSmokeTest {

  private static final Path PROPS = Paths.get("src/main/resources/application.properties");
  private static final Path YAML = Paths.get("src/main/resources/application.yaml");
  private static final Path YML = Paths.get("src/main/resources/application.yml");

  @Test
  void virtualThreadsEnabled() throws Exception {
    List<String> candidates = new ArrayList<>();
    for (Path candidate : List.of(PROPS, YAML, YML)) {
      if (Files.exists(candidate)) {
        candidates.add(Files.readString(candidate));
      }
    }
    assertTrue(!candidates.isEmpty(),
        "RED (intended): no application.properties/yaml yet; "
            + "GREEN requires spring.threads.virtual.enabled=true");
    boolean enabled = candidates.stream()
        .anyMatch(text -> text.contains("spring.threads.virtual.enabled=true")
            || text.contains("spring.threads.virtual.enabled: true"));
    assertTrue(enabled, "spring.threads.virtual.enabled=true property not present");
  }
}
