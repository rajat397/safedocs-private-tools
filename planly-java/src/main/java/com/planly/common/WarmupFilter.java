package com.planly.common;

import java.io.IOException;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * Cold-start path: while the DB is paused, /v1 fails closed with
 * 503 + Retry-After:20 and emits supabase.cold_start telemetry.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 4)
public class WarmupFilter extends OncePerRequestFilter {

  private static final Logger log = LoggerFactory.getLogger(WarmupFilter.class);

  @Override
  protected void doFilterInternal(HttpServletRequest request,
      HttpServletResponse response, FilterChain chain)
      throws ServletException, IOException {
    String uri = request.getRequestURI();
    boolean api = uri != null && (uri.equals("/v1") || uri.startsWith("/v1/"));
    if (api && WarmupState.isCold()) {
      log.warn("supabase.cold_start uri={}", uri);
      response.setStatus(HttpServletResponse.SC_SERVICE_UNAVAILABLE);
      response.setHeader("Retry-After", "20");
      response.setContentType("application/problem+json");
      String requestId = MDC.get(RequestIds.MDC_KEY);
      response.getWriter().write(Problem.toJson(Problem.of("COLD_START", requestId)));
      return;
    }
    chain.doFilter(request, response);
  }
}
