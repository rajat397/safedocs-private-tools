package com.planly.common;

import java.io.IOException;

import org.slf4j.MDC;
import org.springframework.http.HttpStatus;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * Container-level body cap: /v1 writes declaring more than 64KB via
 * Content-Length are rejected with 413 before the body is read. Chunked
 * bodies fall through to the per-endpoint raw-byte caps (32KB steps,
 * 64KB readjust delta), which are checked before parsing.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 2)
public class BodyCapFilter extends OncePerRequestFilter {

  static final long MAX_BODY_BYTES = 64L * 1024;

  @Override
  protected void doFilterInternal(HttpServletRequest request,
      HttpServletResponse response, FilterChain chain)
      throws ServletException, IOException {
    String uri = request.getRequestURI();
    String method = request.getMethod();
    boolean write = method != null
        && (method.equalsIgnoreCase("POST") || method.equalsIgnoreCase("PUT")
            || method.equalsIgnoreCase("PATCH"));
    boolean api = uri != null && (uri.equals("/v1") || uri.startsWith("/v1/"));
    if (api && write && request.getContentLengthLong() > MAX_BODY_BYTES) {
      response.setStatus(HttpStatus.PAYLOAD_TOO_LARGE.value());
      response.setContentType("application/problem+json");
      String requestId = MDC.get(RequestIds.MDC_KEY);
      response.getWriter().write(
          Problem.toJson(Problem.of("PAYLOAD_TOO_LARGE", requestId)));
      return;
    }
    chain.doFilter(request, response);
  }
}
