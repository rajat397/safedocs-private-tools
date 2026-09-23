package com.planly.common;

import java.util.Map;

import org.springframework.http.HttpStatus;

/**
 * Typed API failure: status plus an already-shaped problem+json body.
 */
public class PlanlyException extends RuntimeException {

  private final HttpStatus status;
  private final Map<String, Object> body;

  public PlanlyException(HttpStatus status, Map<String, Object> body) {
    super(String.valueOf(body.get("code")));
    this.status = status;
    this.body = body;
  }

  public HttpStatus status() {
    return status;
  }

  public Map<String, Object> body() {
    return body;
  }
}
