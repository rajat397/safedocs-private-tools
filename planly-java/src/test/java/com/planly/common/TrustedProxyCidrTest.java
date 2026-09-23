package com.planly.common;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Same-package coverage for {@link TrustedProxy#cidrMatch}, which is
 * package-private by design (only {@code isTrusted} is public API).
 * Moved here from {@code com.planly.unit.CommonUnitTest} so no
 * production visibility change is needed.
 */
class TrustedProxyCidrTest {

  @AfterEach
  void clearOverride() {
    TrustedProxy.clearTrustedProxiesForTests();
  }

  @Test
  void cidrMatchBranches() {
    assertThat(TrustedProxy.cidrMatch("10.0.0.0/8", "10.1.2.3")).isTrue();
    assertThat(TrustedProxy.cidrMatch("10.0.0.0/8", "11.0.0.1")).isFalse();
    assertThat(TrustedProxy.cidrMatch("nope", "10.0.0.1")).isFalse();
    assertThat(TrustedProxy.cidrMatch("10.0.0.0/99", "10.0.0.1")).isFalse();
    assertThat(TrustedProxy.cidrMatch("10.0.0.0/0", "1.2.3.4")).isTrue();
    assertThat(TrustedProxy.cidrMatch("999.0.0.0/8", "9.0.0.1")).isFalse();
  }

  @Test
  void cidrEdgeBranches() {
    assertThat(TrustedProxy.cidrMatch(null, "1.2.3.4")).isFalse();
    assertThat(TrustedProxy.cidrMatch("10.0.0.0/8", null)).isFalse();
    assertThat(TrustedProxy.cidrMatch(null, null)).isFalse();
    assertThat(TrustedProxy.cidrMatch("", "1.2.3.4")).isFalse();
    assertThat(TrustedProxy.cidrMatch("10.0.0.0", "10.0.0.1")).isFalse();
    assertThat(TrustedProxy.cidrMatch("10.0.0/8", "10.0.0.1")).isFalse();
    assertThat(TrustedProxy.cidrMatch("10.0.0.256/8", "10.0.0.1")).isFalse();
    assertThat(TrustedProxy.cidrMatch("10.0.0.a/8", "10.0.0.1")).isFalse();
    assertThat(TrustedProxy.cidrMatch("10.0.0.0/-1", "10.0.0.1")).isFalse();
    assertThat(TrustedProxy.cidrMatch("10.0.0.0/abc", "10.0.0.1")).isFalse();
    assertThat(TrustedProxy.cidrMatch("10.0.0.0/33", "10.0.0.1")).isFalse();
    assertThat(TrustedProxy.cidrMatch("10.0.0.1/32", "10.0.0.1")).isTrue();
    assertThat(TrustedProxy.cidrMatch("10.0.0.1/32", "10.0.0.2")).isFalse();
    assertThat(TrustedProxy.cidrMatch(" 10.0.0.0 / 8 ", "10.9.9.9")).isTrue();
    assertThat(TrustedProxy.cidrMatch("10.0.0.0/8", "not-an-ip")).isFalse();
    assertThat(TrustedProxy.cidrMatch("10.0.0.0/8", "10.0.0")).isFalse();
  }

  @Test
  void trustedEntriesAndPeers() {
    TrustedProxy.setTrustedProxiesForTests(null);
    assertThat(TrustedProxy.isTrusted("10.0.0.1")).isFalse();
    TrustedProxy.setTrustedProxiesForTests("   ");
    assertThat(TrustedProxy.isTrusted("10.0.0.1")).isFalse();
    assertThat(TrustedProxy.isTrusted(null)).isFalse();

    TrustedProxy.setTrustedProxiesForTests("10.0.0.0/8, 1.2.3.4");
    assertThat(TrustedProxy.isTrusted("10.9.9.9")).isTrue();
    assertThat(TrustedProxy.isTrusted("  1.2.3.4  ")).isTrue();
    assertThat(TrustedProxy.isTrusted("9.9.9.9")).isFalse();
    assertThat(TrustedProxy.isTrusted(null)).isFalse();

    TrustedProxy.setTrustedProxiesForTests(" , ,10.0.0.0/8,, ");
    assertThat(TrustedProxy.isTrusted("10.1.1.1")).isTrue();
    assertThat(TrustedProxy.isTrusted("11.0.0.1")).isFalse();
  }

  @Test
  void clientIpTrustedLanes() {
    TrustedProxy.setTrustedProxiesForTests("9.9.9.9");

    MockHttpServletRequest cf = new MockHttpServletRequest();
    cf.setRemoteAddr("9.9.9.9");
    cf.addHeader("CF-Connecting-IP", "  5.6.7.8  ");
    assertThat(TrustedProxy.clientIp(cf)).isEqualTo("5.6.7.8");

    MockHttpServletRequest xff = new MockHttpServletRequest();
    xff.setRemoteAddr("9.9.9.9");
    xff.addHeader("CF-Connecting-IP", "   ");
    xff.addHeader("X-Forwarded-For", "1.1.1.1, 2.2.2.2");
    assertThat(TrustedProxy.clientIp(xff)).isEqualTo("1.1.1.1");

    MockHttpServletRequest direct = new MockHttpServletRequest();
    direct.setRemoteAddr("9.9.9.9");
    assertThat(TrustedProxy.clientIp(direct)).isEqualTo("9.9.9.9");

    MockHttpServletRequest unknown = new MockHttpServletRequest();
    unknown.setRemoteAddr(null);
    assertThat(TrustedProxy.clientIp(unknown)).isEqualTo("unknown");
  }

  @Test
  void forwardedHostTrustedLanes() {
    TrustedProxy.setTrustedProxiesForTests("9.9.9.9");

    MockHttpServletRequest valued = new MockHttpServletRequest();
    valued.setRemoteAddr("9.9.9.9");
    valued.addHeader("X-Forwarded-Host", "  example.com  ");
    assertThat(TrustedProxy.forwardedHost(valued)).isEqualTo("example.com");

    MockHttpServletRequest missing = new MockHttpServletRequest();
    missing.setRemoteAddr("9.9.9.9");
    assertThat(TrustedProxy.forwardedHost(missing)).isNull();

    MockHttpServletRequest blank = new MockHttpServletRequest();
    blank.setRemoteAddr("9.9.9.9");
    blank.addHeader("X-Forwarded-Host", "   ");
    assertThat(TrustedProxy.forwardedHost(blank)).isNull();
  }
}
