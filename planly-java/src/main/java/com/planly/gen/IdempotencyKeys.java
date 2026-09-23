package com.planly.gen;

import java.util.regex.Pattern;

/**
 * Idempotency-Key is strict UUIDv4; anything else is 400.
 */
public final class IdempotencyKeys {

  private static final Pattern UUID_V4 = Pattern.compile(
      "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}"
          + "-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$");

  private IdempotencyKeys() {
  }

  public static boolean valid(String value) {
    return value != null && UUID_V4.matcher(value.trim()).matches();
  }

  public static boolean validOptional(String value) {
    return value == null || value.isEmpty() || valid(value);
  }
}
