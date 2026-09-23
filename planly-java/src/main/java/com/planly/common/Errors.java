package com.planly.common;

import java.util.Map;

import org.slf4j.MDC;
import org.springframework.http.HttpStatus;

/**
 * Factory for the normative error envelopes used across controllers.
 */
public final class Errors {

  private Errors() {
  }

  public static String requestId() {
    String id = MDC.get(RequestIds.MDC_KEY);
    return id == null ? RequestIds.newId() : id;
  }

  public static PlanlyException fail(HttpStatus status, String code) {
    return new PlanlyException(status, Problem.of(code, requestId()));
  }

  public static PlanlyException fail(HttpStatus status, String code,
      Map<String, Object> extra) {
    return new PlanlyException(status, Problem.of(code, requestId(), extra));
  }
}
