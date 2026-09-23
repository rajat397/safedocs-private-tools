package com.planly.unit;

import java.util.List;

import com.planly.common.CorsFilter;
import com.planly.common.MetricsFilter;
import com.planly.common.PlanlyScheduling;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Unit coverage for CORS rules, metrics routing and the cron entry points
 * (invoked directly — slice tests never start the scheduler).
 */
class FiltersUnitTest {

  @Test
  void corsOriginRules() {
    assertThat(CorsFilter.allowedOrigin("https://app.planly.test")).isTrue();
    assertThat(CorsFilter.allowedOrigin("https://app.planly.")).isFalse();
    assertThat(CorsFilter.allowedOrigin("https://evil.example")).isFalse();
    assertThat(CorsFilter.allowedOrigin(null)).isFalse();
    assertThat(CorsFilter.allowedOrigin("https://app.planly.a/b")).isFalse();
    assertThat(CorsFilter.allowedOrigin("https://app.planly.a?x")).isFalse();
    assertThat(CorsFilter.allowedOrigin("https://app.planly.a#x")).isFalse();
    assertThat(CorsFilter.allowedOrigin("https://app.planly.a b")).isFalse();

    assertThat(CorsFilter.v1Method("GET")).isTrue();
    assertThat(CorsFilter.v1Method("options")).isTrue();
    assertThat(CorsFilter.v1Method("PATCH")).isFalse();
    assertThat(CorsFilter.v1Method(null)).isFalse();
    assertThat(CorsFilter.ALLOWED_METHODS).isEqualTo("GET,POST,PUT,DELETE");
    assertThat(CorsFilter.ALLOWED_HEADERS).contains("Idempotency-Key");
  }

  @Test
  void metricsRoutesAndCounts() throws Exception {
    SimpleMeterRegistry registry = new SimpleMeterRegistry();
    MetricsFilter filter = new MetricsFilter(registry);
    MetricsFilter passThrough = new MetricsFilter(null);

    for (String uri : List.of("/v1/drafts", "/v1/operations/x", "/v1/plans/y",
        "/v1/health", "/v1/other", "/health", "/nothing")) {
      MockHttpServletRequest request = new MockHttpServletRequest("GET", uri);
      MockHttpServletResponse response = new MockHttpServletResponse();
      filter.doFilter(request, response, (req, res) -> {
      });
      MockHttpServletResponse bare = new MockHttpServletResponse();
      passThrough.doFilter(new MockHttpServletRequest("GET", uri), bare,
          (req, res) -> {
          });
    }
    assertThat(registry.get("planly.http.requests").tag("route", "drafts")
        .counter().count()).isEqualTo(1.0);
    assertThat(registry.get("planly.http.requests").tag("route", "operations")
        .counter().count()).isEqualTo(1.0);
    assertThat(registry.get("planly.http.requests").tag("route", "plans")
        .counter().count()).isEqualTo(1.0);
    assertThat(registry.get("planly.http.requests").tag("route", "health")
        .counter().count()).isEqualTo(1.0);
    assertThat(registry.get("planly.http.requests").tag("route", "v1-other")
        .counter().count()).isEqualTo(1.0);
    assertThat(registry.get("planly.http.requests").tag("route", "other")
        .counter().count()).isEqualTo(2.0);
    assertThat(registry.get("planly.http.latency").timers().size()).isPositive();
  }

  @Test
  void schedulingEntryPointsRun() {
    PlanlyScheduling scheduling = new PlanlyScheduling();
    scheduling.warmup();
    scheduling.purgeDrafts();
    scheduling.purgeOps();
  }
}
