package com.planly.common;

import java.io.IOException;
import java.util.List;
import java.util.Map;

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
 * Creation-core has no PATCH surface: {@code PATCH /v1/*} gets 405 with an
 * explicit Allow list, matching the Hono runtime. Allowed methods follow the
 * contract (GET, POST, PUT, DELETE).
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 3)
public class MethodGuardFilter extends OncePerRequestFilter {

  static final List<String> ALLOWED = List.of("GET", "POST", "PUT", "DELETE");

  @Override
  protected void doFilterInternal(HttpServletRequest request,
      HttpServletResponse response, FilterChain chain)
      throws ServletException, IOException {
    String uri = request.getRequestURI();
    if (uri != null && (uri.equals("/v1") || uri.startsWith("/v1/"))
        && "PATCH".equalsIgnoreCase(request.getMethod())) {
      String requestId = MDC.get(RequestIds.MDC_KEY);
      response.setStatus(HttpServletResponse.SC_METHOD_NOT_ALLOWED);
      response.setHeader("Allow", "GET, POST, PUT, DELETE");
      response.setContentType("application/problem+json");
      Map<String, Object> body =
          Problem.of("METHOD_NOT_ALLOWED", requestId, Map.of("allow", ALLOWED));
      response.getWriter().write(Problem.toJson(body));
      return;
    }
    chain.doFilter(request, response);
  }
}
