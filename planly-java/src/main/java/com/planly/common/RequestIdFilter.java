package com.planly.common;

import java.io.IOException;

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
 * Assigns every request an id, exposes it via MDC and the response header.
 * Order: runs before every other Planly filter.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class RequestIdFilter extends OncePerRequestFilter {

  @Override
  protected void doFilterInternal(HttpServletRequest request,
      HttpServletResponse response, FilterChain chain)
      throws ServletException, IOException {
    String requestId = request.getHeader(RequestIds.HEADER);
    if (!RequestIds.valid(requestId)) {
      requestId = RequestIds.newId();
    }
    MDC.put(RequestIds.MDC_KEY, requestId);
    response.setHeader(RequestIds.HEADER, requestId);
    try {
      chain.doFilter(request, response);
    } finally {
      MDC.remove(RequestIds.MDC_KEY);
    }
  }
}
