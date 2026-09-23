package com.planly.arch;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Stream;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Placeholder guard until ArchUnit lands: bans {@code System.out} usage and
 * direct {@code com.fasterxml.jackson} imports under {@code src/main/java}.
 * RED while the main scaffold is missing; GREEN once sources exist and obey it.
 */
class ArchitectureGuardTest {

  private static final Path MAIN = Paths.get("src/main/java");

  @Test
  void noSystemOutOrJacksonImports() throws Exception {
    assertTrue(Files.isDirectory(MAIN),
        "RED (intended): src/main/java scaffold missing — nothing to guard yet");
    List<String> violations = new ArrayList<>();
    try (Stream<Path> files = Files.walk(MAIN)) {
      for (Path file : files.filter(p -> p.toString().endsWith(".java")).toList()) {
        List<String> lines = Files.readAllLines(file);
        for (int i = 0; i < lines.size(); i++) {
          String trimmed = lines.get(i).trim();
          if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) {
            continue;
          }
          if (trimmed.startsWith("import com.fasterxml.jackson")) {
            violations.add(file + ":" + (i + 1) + " jackson import");
          }
          if (lines.get(i).contains("System.out")) {
            violations.add(file + ":" + (i + 1) + " System.out usage");
          }
        }
      }
    }
    assertTrue(violations.isEmpty(), "architecture violations:\n" + String.join("\n", violations));
  }
}
