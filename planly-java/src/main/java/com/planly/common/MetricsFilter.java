package com.planly.common;

import java.io.IOException;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * Micrometer request telemetry: per-route counters plus latency timers.
 * No-op when no registry bean exists (e.g. MVC slice tests).
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 5)
public class MetricsFilter extends OncePerRequestFilter {

  private final MeterRegistry registry;

  public MetricsFilter(@Autowired(required = false) MeterRegistry registry) {
    this.registry = registry;
  }

  @Override
  protected void doFilterInternal(HttpServletRequest request,
      HttpServletResponse response, FilterChain chain)
      throws ServletException, IOException {
    if (registry == null) {
      chain.doFilter(request, response);
      return;
    }
    long start = System.nanoTime();
    try {
      chain.doFilter(request, response);
    } finally {
      String route = routeOf(request.getRequestURI());
      Counter.builder("planly.http.requests")
          .tag("route", route)
          .tag("status", String.valueOf(response.getStatus()))
          .register(registry).increment();
      Timer.builder("planly.http.latency")
          .tag("route", route)
          .register(registry)
          .record(System.nanoTime() - start, java.util.concurrent.TimeUnit.NANOSECONDS);
    }
  }

  private String routeOf(String uri) {
    if (uri == null) {
      return "unknown";
    }
    if (uri.startsWith("/v1/drafts")) {
      return "drafts";
    }
    if (uri.startsWith("/v1/operations")) {
      return "operations";
    }
    if (uri.startsWith("/v1/plans")) {
      return "plans";
    }
    if (uri.startsWith("/v1/health")) {
      return "health";
    }
    if (uri.startsWith("/v1")) {
      return "v1-other";
    }
    return "other";
  }
}
