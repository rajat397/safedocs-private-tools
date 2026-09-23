package com.planly.common;

import org.springframework.http.HttpStatus;

/**
 * 429 carrier: the handler attaches Retry-After from {@link #retryAfter()}.
 */
public class RateLimited extends PlanlyException {

  private final long retryAfter;

  public RateLimited(long retryAfter) {
    super(HttpStatus.TOO_MANY_REQUESTS,
        Problem.of("RATE_LIMITED", Errors.requestId()));
    this.retryAfter = retryAfter;
  }

  public long retryAfter() {
    return retryAfter;
  }
}
