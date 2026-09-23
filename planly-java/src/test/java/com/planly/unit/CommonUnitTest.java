package com.planly.unit;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import com.planly.common.Errors;
import com.planly.common.PlanlyException;
import com.planly.common.Problem;
import com.planly.common.RateLimited;
import com.planly.common.RequestIds;
import com.planly.common.TrustedProxy;
import com.planly.common.WarmupState;
import com.planly.auth.AuthException;
import org.junit.jupiter.api.Test;
import org.slf4j.MDC;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Unit coverage for envelopes, ids, proxy gate, warmup flag and error types.
 */
class CommonUnitTest {

  @Test
  void problemJsonEscaping() {
    Map<String, Object> body = new LinkedHashMap<>();
    body.put("code", "X\"\\\n\r\t\b\f\u0001end");
    body.put("n", 42);
    body.put("b", true);
    body.put("nil", null);
    body.put("list", new java.util.ArrayList<>(java.util.Arrays.asList("a", 1, null)));
    body.put("nested", Map.of("k", "v"));
    body.put("other", new Object() {
      @Override
      public String toString() {
        return "obj";
      }
    });
    String json = Problem.toJson(body);
    assertThat(json).startsWith("{").endsWith("}");
    assertThat(json).contains("\\\"").contains("\\\\").contains("\\n")
        .contains("\\r").contains("\\t").contains("\\b").contains("\\f")
        .contains("\\u0001").contains("\"n\":42").contains("\"b\":true")
        .contains("\"nil\":null").contains("[\"a\",1,null]")
        .contains("\"nested\":{\"k\":\"v\"}").contains("\"other\":\"obj\"");

    assertThat(Problem.toJson(Map.of())).isEqualTo("{}");
    assertThat(Problem.of("C", "r")).containsEntry("code", "C");
    assertThat(Problem.of("C", "r", null)).doesNotContainKey("extra");
    assertThat(Problem.of("C", "r", Map.of("e", 1))).containsEntry("e", 1);
  }

  @Test
  void requestIds() {
    assertThat(RequestIds.valid("abc-123-XYZ")).isTrue();
    assertThat(RequestIds.valid("<script>")).isFalse();
    assertThat(RequestIds.valid(null)).isFalse();
    assertThat(RequestIds.valid("")).isFalse();
    assertThat(RequestIds.valid("x".repeat(65))).isFalse();
    assertThat(RequestIds.valid("x".repeat(64))).isTrue();
    assertThat(RequestIds.newId()).matches("^[A-Za-z0-9-]{1,64}$");
    assertThat(RequestIds.HEADER).isEqualTo("X-Request-Id");
  }

  @Test
  void trustedProxyDefaultsToSocketAddress() {
    assertThat(TrustedProxy.isTrusted("127.0.0.1")).isFalse();
    assertThat(TrustedProxy.isTrusted(null)).isFalse();
    // IPv4 CIDR branches live in com.planly.common.TrustedProxyCidrTest
    // (same package as TrustedProxy, so it can call package-private cidrMatch).

    org.springframework.mock.web.MockHttpServletRequest request =
        new org.springframework.mock.web.MockHttpServletRequest();
    request.setRemoteAddr("9.9.9.9");
    request.addHeader("X-Forwarded-For", "1.2.3.4");
    request.addHeader("CF-Connecting-IP", "5.6.7.8");
    assertThat(TrustedProxy.clientIp(request)).isEqualTo("9.9.9.9");
    assertThat(TrustedProxy.forwardedHost(request)).isNull();
  }

  @Test
  void errorsCarryRequestId() {
    MDC.clear();
    PlanlyException noMdc = Errors.fail(org.springframework.http.HttpStatus.BAD_REQUEST, "X");
    assertThat(noMdc.status()).isEqualTo(org.springframework.http.HttpStatus.BAD_REQUEST);
    assertThat(noMdc.body()).containsKey("requestId");
    assertThat(noMdc.getMessage()).isEqualTo("X");

    MDC.put(RequestIds.MDC_KEY, "fixed-id");
    try {
      PlanlyException withMdc = Errors.fail(
          org.springframework.http.HttpStatus.CONFLICT, "Y", Map.of("k", 1));
      assertThat(withMdc.body()).containsEntry("requestId", "fixed-id");
      RateLimited limited = new RateLimited(7L);
      assertThat(limited.retryAfter()).isEqualTo(7L);
      assertThat(limited.status())
          .isEqualTo(org.springframework.http.HttpStatus.TOO_MANY_REQUESTS);
      assertThat(Errors.requestId()).isEqualTo("fixed-id");
    } finally {
      MDC.clear();
    }
  }

  @Test
  void authExceptionCtors() {
    assertThat(new AuthException("m").getMessage()).isEqualTo("m");
    RuntimeException cause = new RuntimeException("root");
    assertThat(new AuthException("m", cause).getCause()).isSameAs(cause);
  }

  @Test
  void warmupFlag() {
    WarmupState.setColdForTests(true);
    assertThat(WarmupState.isCold()).isTrue();
    WarmupState.markWarm();
    assertThat(WarmupState.isCold()).isFalse();
    WarmupState.markCold();
    assertThat(WarmupState.isCold()).isTrue();
    assertThat(WarmupState.coldStarts()).isPositive();
    WarmupState.markCold();
    WarmupState.setColdForTests(false);
    assertThat(WarmupState.isCold()).isFalse();
  }
}
