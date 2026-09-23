package com.planly.common;

import java.io.IOException;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * Canonical-host guard. Only {@code api.planly.*} serves the API; any other
 * planly host 301-redirects to its {@code api.planly.*} twin. Local, test and
 * explicitly configured hosts pass through so dev/test never redirect-loop.
 * {@code X-Forwarded-Host} is honoured only behind a trusted proxy.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 1)
public class HostFilter extends OncePerRequestFilter {

  private static final Logger log = LoggerFactory.getLogger(HostFilter.class);

  @Override
  protected void doFilterInternal(HttpServletRequest request,
      HttpServletResponse response, FilterChain chain)
      throws ServletException, IOException {
    String host = header(request, "Host");
    if (host == null || host.isBlank()) {
      host = TrustedProxy.forwardedHost(request);
    }
    String bare = bare(host);
    if (passthrough(bare)) {
      chain.doFilter(request, response);
      return;
    }
    String canonical = canonicalFor(bare);
    String query = request.getQueryString();
    String location = request.getScheme() + "://" + canonical
        + request.getRequestURI() + (query == null ? "" : "?" + query);
    log.info("host redirect host={} canonical={}", bare, canonical);
    response.setStatus(HttpServletResponse.SC_MOVED_PERMANENTLY);
    response.setHeader("Location", location);
  }

  private boolean passthrough(String bare) {
    if (bare.isEmpty() || bare.equals("localhost") || bare.equals("127.0.0.1")
        || bare.equals("test") || bare.startsWith("localhost:")) {
      return true;
    }
    String configured = System.getenv("CANONICAL_API_HOST");
    if (configured != null && !configured.isBlank()
        && bare.equals(configured.toLowerCase().split(":")[0])) {
      return true;
    }
    return bare.startsWith("api.planly.") && bare.length() > "api.planly.".length();
  }

  private String canonicalFor(String bare) {
    if (bare.startsWith("app.planly.") && bare.length() > "app.planly.".length()) {
      return "api.planly." + bare.substring("app.planly.".length());
    }
    int idx = bare.indexOf(".planly.");
    if (idx >= 0) {
      String suffix = bare.substring(idx + ".planly.".length());
      if (!suffix.isEmpty()) {
        return "api.planly." + suffix;
      }
    }
    String configured = System.getenv("CANONICAL_API_HOST");
    if (configured != null && !configured.isBlank()) {
      return configured.toLowerCase();
    }
    return "api.planly.dev";
  }

  private String bare(String host) {
    if (host == null) {
      return "";
    }
    int colon = host.indexOf(':');
    String name = colon < 0 ? host : host.substring(0, colon);
    return name.toLowerCase();
  }

  private String header(HttpServletRequest request, String name) {
    return request.getHeader(name);
  }
}
