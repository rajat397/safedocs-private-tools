package com.planly.unit;

import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;

import com.planly.auth.JwtVerifier;
import com.planly.auth.AuthException;
import com.planly.common.HostFilter;
import com.planly.common.MetricsFilter;
import com.planly.common.Problem;
import com.planly.common.TrustedProxy;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Branch-gap coverage for TrustedProxy (public lanes), HostFilter,
 * JwtVerifier lenient lane, MetricsFilter routing and the Problem encoder.
 * Package-private targets (cidrMatch, serialisedBytes) are covered from
 * their own-package tests. All unit-level (no env).
 */
class BranchGapUnitTest {

  @Test
  void trustedProxyUntrustedLanes() {
    assertThat(TrustedProxy.isTrusted(null)).isFalse();
    assertThat(TrustedProxy.isTrusted("")).isFalse();
    assertThat(TrustedProxy.isTrusted("127.0.0.1")).isFalse();

    MockHttpServletRequest request = new MockHttpServletRequest();
    request.setRemoteAddr("9.9.9.9");
    request.addHeader("X-Forwarded-For", "1.2.3.4");
    assertThat(TrustedProxy.clientIp(request)).isEqualTo("9.9.9.9");
    assertThat(TrustedProxy.forwardedHost(request)).isNull();

    MockHttpServletRequest blankHost = new MockHttpServletRequest();
    blankHost.setRemoteAddr("9.9.9.9");
    blankHost.addHeader("X-Forwarded-Host", "   ");
    assertThat(TrustedProxy.forwardedHost(blankHost)).isNull();
  }

  // ---- HostFilter via direct doFilter ----

  private boolean passesThrough(String host, String query) throws Exception {
    HostFilter filter = new HostFilter();
    MockHttpServletRequest request = new MockHttpServletRequest("GET", "/health");
    request.setScheme("https");
    request.setRequestURI("/health");
    if (query != null) {
      request.setQueryString(query);
    }
    if (host != null) {
      request.addHeader("Host", host);
    }
    MockHttpServletResponse response = new MockHttpServletResponse();
    AtomicBoolean chained = new AtomicBoolean(false);
    filter.doFilter(request, response, (req, res) -> chained.set(true));
    return chained.get();
  }

  private MockHttpServletResponse redirectFor(String host, String query) throws Exception {
    HostFilter filter = new HostFilter();
    MockHttpServletRequest request = new MockHttpServletRequest("GET", "/health");
    request.setScheme("https");
    request.setRequestURI("/health");
    if (query != null) {
      request.setQueryString(query);
    }
    if (host != null) {
      request.addHeader("Host", host);
    }
    MockHttpServletResponse response = new MockHttpServletResponse();
    AtomicBoolean chained = new AtomicBoolean(false);
    filter.doFilter(request, response, (req, res) -> chained.set(true));
    assertThat(chained).isFalse();
    return response;
  }

  @Test
  void hostFilterPassthroughLanes() throws Exception {
    assertThat(passesThrough("localhost", null)).isTrue();
    assertThat(passesThrough("127.0.0.1", null)).isTrue();
    assertThat(passesThrough("test", null)).isTrue();
    assertThat(passesThrough("TEST", null)).isTrue();
    assertThat(passesThrough("localhost:3000", null)).isTrue();
    assertThat(passesThrough("api.planly.test", null)).isTrue();
    assertThat(passesThrough("API.PLANLY.TEST", null)).isTrue();
    assertThat(passesThrough(null, null)).isTrue();
    assertThat(passesThrough("   ", null)).isTrue();
    assertThat(passesThrough("", null)).isTrue();
  }

  @Test
  void hostFilterRedirectLanes() throws Exception {
    MockHttpServletResponse app = redirectFor("app.planly.test", null);
    assertThat(app.getStatus()).isEqualTo(301);
    assertThat(app.getHeader("Location")).contains("api.planly.test");

    MockHttpServletResponse withQuery = redirectFor("app.planly.test", "a=1");
    assertThat(withQuery.getHeader("Location")).contains("?a=1");

    MockHttpServletResponse sub = redirectFor("foo.planly.test", null);
    assertThat(sub.getHeader("Location")).contains("api.planly.test");

    MockHttpServletResponse evil = redirectFor("evil.example", null);
    assertThat(evil.getStatus()).isEqualTo(301);
    assertThat(evil.getHeader("Location")).contains("api.planly.dev");

    MockHttpServletResponse withPort = redirectFor("evil.example:8080", null);
    assertThat(withPort.getHeader("Location")).contains("api.planly.dev");

    // Degenerate planly hosts: exact prefixes / empty suffix fall to default.
    assertThat(redirectFor("app.planly.", null).getHeader("Location"))
        .contains("api.planly.dev");
    assertThat(redirectFor("api.planly.", null).getHeader("Location"))
        .contains("api.planly.dev");
    assertThat(redirectFor("x.planly.", null).getHeader("Location"))
        .contains("api.planly.dev");
  }

  // ---- JwtVerifier lenient edges ----

  @Test
  void lenientRejectsDottedNonJwt() {
    JwtVerifier.resetForTests();
    try {
      assertThat(JwtVerifier.lenientAllowed()).isTrue();
      assertThatThrownBy(() -> JwtVerifier.verify("a.!!!.c"))
          .isInstanceOf(AuthException.class);
      assertThatThrownBy(() -> JwtVerifier.verify("h."
          + base64("{\"no\":\"sub\"}") + ".s")).isInstanceOf(AuthException.class);
      assertThatThrownBy(() -> JwtVerifier.verify("h."
          + base64("{\"sub\":\"\"}") + ".s")).isInstanceOf(AuthException.class);
      assertThatThrownBy(() -> JwtVerifier.verify("x".repeat(257)))
          .isInstanceOf(AuthException.class);
    } finally {
      JwtVerifier.resetForTests();
    }
  }

  private static String base64(String json) {
    return java.util.Base64.getUrlEncoder().withoutPadding()
        .encodeToString(json.getBytes(java.nio.charset.StandardCharsets.UTF_8));
  }

  // ---- MetricsFilter routeOf null/unknown ----

  @Test
  void metricsRouteOfNullAndUnknown() throws Exception {
    Method routeOf = MetricsFilter.class.getDeclaredMethod("routeOf", String.class);
    routeOf.setAccessible(true);
    MetricsFilter filter = new MetricsFilter(null);
    assertThat(routeOf.invoke(filter, (String) null)).isEqualTo("unknown");
    assertThat(routeOf.invoke(filter, "/v2/x")).isEqualTo("other");
    assertThat(routeOf.invoke(filter, "/v1")).isEqualTo("v1-other");
  }

  // ---- Problem / Step encoder extras ----

  @Test
  void problemEncoderExtras() {
    Map<String, Object> body = new LinkedHashMap<>();
    body.put("empty", new ArrayList<>());
    body.put("nested", new ArrayList<>(Arrays.asList(
        new LinkedHashMap<>(Map.of("k", "v")), new ArrayList<>(List.of(1, 2)))));
    body.put("d", 1.5);
    body.put("f", false);
    body.put("ctrl", "a\u0000b");
    body.put("emoji", "caf\u00e9 \uD83D\uDE00");
    String json = Problem.toJson(body);
    assertThat(json).contains("\"empty\":[]").contains("\"d\":1.5")
        .contains("\"f\":false").contains("caf").contains("\\u0000");
  }

}
