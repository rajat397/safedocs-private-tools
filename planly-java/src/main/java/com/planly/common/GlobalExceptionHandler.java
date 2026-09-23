package com.planly.common;

import java.util.Map;

import com.planly.auth.AuthException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/**
 * All errors leave the API as problem+json with code + requestId.
 * Unexpected failures are 500 INTERNAL with the id only (no leak).
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

  private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);
  private static final MediaType PROBLEM = MediaType.parseMediaType("application/problem+json");

  @ExceptionHandler(AuthException.class)
  public ResponseEntity<Map<String, Object>> unauthenticated(AuthException ex) {
    String requestId = MDC.get(RequestIds.MDC_KEY);
    return problem(HttpStatus.UNAUTHORIZED, Problem.of("UNAUTHENTICATED", requestId));
  }

  @ExceptionHandler(PlanlyException.class)
  public ResponseEntity<Map<String, Object>> planly(PlanlyException ex) {
    if (ex instanceof RateLimited rate) {
      return ResponseEntity.status(rate.status())
          .header("Retry-After", String.valueOf(rate.retryAfter()))
          .contentType(PROBLEM).body(rate.body());
    }
    return problem(ex.status(), ex.body());
  }

  @ExceptionHandler(Exception.class)
  public ResponseEntity<Map<String, Object>> unexpected(Exception ex) {
    String requestId = MDC.get(RequestIds.MDC_KEY);
    log.error("api error requestId={}", requestId, ex);
    return problem(HttpStatus.INTERNAL_SERVER_ERROR, Problem.of("INTERNAL", requestId));
  }

  private ResponseEntity<Map<String, Object>> problem(HttpStatus status,
      Map<String, Object> body) {
    return ResponseEntity.status(status).contentType(PROBLEM).body(body);
  }
}
