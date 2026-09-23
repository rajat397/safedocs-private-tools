package com.planly.common;

import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Request-id helpers shared by the filter and the exception handler.
 * Inbound ids must match {@code ^[A-Za-z0-9-]{1,64}$}; anything else is
 * discarded and regenerated so log injection via the header is impossible.
 */
public final class RequestIds {

  public static final String HEADER = "X-Request-Id";
  public static final String MDC_KEY = "requestId";
  private static final Pattern VALID = Pattern.compile("^[A-Za-z0-9-]{1,64}$");

  private RequestIds() {
  }

  public static String newId() {
    return UUID.randomUUID().toString();
  }

  public static boolean valid(String requestId) {
    return requestId != null && VALID.matcher(requestId).matches();
  }
}
