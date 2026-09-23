package com.planly.common;

import java.io.IOException;
import java.util.Set;

import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * Normative CORS: allowOrigin {@code https://app.planly.*} only,
 * methods GET/POST/PUT/DELETE only, credentials true. Preflight OPTIONS
 * gets 204. Never blocks: disallowed origins simply get no echo.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 2)
public class CorsFilter extends OncePerRequestFilter {

  public static final String ALLOWED_METHODS = "GET,POST,PUT,DELETE";
  public static final String ALLOWED_HEADERS =
      "Authorization,Content-Type,Idempotency-Key,If-Match,If-None-Match";
  private static final String ORIGIN_PREFIX = "https://app.planly.";
  private static final Set<String> V1_METHODS =
      Set.of("GET", "POST", "PUT", "DELETE", "OPTIONS");

  public static boolean allowedOrigin(String origin) {
    if (origin == null || !origin.startsWith(ORIGIN_PREFIX)) {
      return false;
    }
    String suffix = origin.substring(ORIGIN_PREFIX.length());
    if (suffix.isEmpty() || suffix.contains("/") || suffix.contains("?")
        || suffix.contains("#") || suffix.matches(".*\\s.*")) {
      return false;
    }
    return true;
  }

  @Override
  protected void doFilterInternal(HttpServletRequest request,
      HttpServletResponse response, FilterChain chain)
      throws ServletException, IOException {
    String origin = request.getHeader("Origin");
    if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
      response.setHeader("Vary", "Origin");
      response.setHeader("Access-Control-Allow-Methods", ALLOWED_METHODS);
      response.setHeader("Access-Control-Allow-Headers", ALLOWED_HEADERS);
      response.setHeader("Access-Control-Allow-Credentials", "true");
      response.setHeader("Access-Control-Max-Age", "600");
      if (allowedOrigin(origin)) {
        response.setHeader("Access-Control-Allow-Origin", origin);
      }
      response.setStatus(HttpServletResponse.SC_NO_CONTENT);
      return;
    }
    chain.doFilter(request, response);
    if (allowedOrigin(origin)) {
      response.setHeader("Access-Control-Allow-Origin", origin);
    }
    if (response.getHeader("Vary") == null) {
      response.setHeader("Vary", "Origin");
    }
    response.setHeader("Access-Control-Allow-Credentials", "true");
  }

  public static boolean v1Method(String method) {
    return method != null && V1_METHODS.contains(method.toUpperCase());
  }
}
