package com.planly.plan;

import java.util.LinkedHashMap;
import java.util.Map;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Unit coverage for plan ETags, If-None-Match normalisation, the teaser
 * allowlist (default-deny: unlisted keys never leak) and DTO shapes.
 */
class PlanStaticsTest {

  private static PlanStore.PlanRecord record(Map<String, Object> teaser,
      Map<String, Object> full) {
    return new PlanStore.PlanRecord("p1", "d1", 1, teaser, full, 1000L);
  }

  @Test
  void etagAndNormalize() {
    assertThat(PlanController.etag("p1", 3)).isEqualTo("\"plan-p1-v3\"");
    assertThat(PlanController.normalize("\"plan-p1-v3\"")).isEqualTo("plan-p1-v3");
    assertThat(PlanController.normalize("W/\"plan-p1-v3\"")).isEqualTo("plan-p1-v3");
    assertThat(PlanController.normalize("  plan-p1-v3  ")).isEqualTo("plan-p1-v3");
    assertThat(PlanController.normalize(null)).isNull();
    assertThat(PlanController.normalize("\"\"")).isNull();
  }

  @Test
  void teaserDefaultDenyUnlistedKeys() {
    Map<String, Object> teaser = new LinkedHashMap<>();
    teaser.put("title", "<b>Algebra</b> plan");
    teaser.put("summary", "s");
    teaser.put("stepCount", 1);
    teaser.put("priceRange", "free");
    teaser.put("secret", "must-not-leak");
    Map<String, Object> full = Map.of("metrics", Map.of("a", 1));

    PlanView view = TeaserGuard.filter(record(teaser, full), false);
    assertThat(view).isInstanceOf(PlanView.Teaser.class);
    assertThat(view.teaser()).containsOnlyKeys("title", "summary", "stepCount",
        "priceRange");
    assertThat(view.teaser().get("title")).isEqualTo("Algebra plan");
    assertThat(((PlanView.Teaser) view).full()).isNull();

    PlanView fullView = TeaserGuard.filter(record(teaser, full), true);
    assertThat(fullView).isInstanceOf(PlanView.Full.class);
    assertThat(((PlanView.Full) fullView).full()).containsKey("metrics");
    assertThatThrownUnsupportedMutation(view.teaser());
  }

  private static void assertThatThrownUnsupportedMutation(Map<String, Object> map) {
    try {
      map.put("x", 1);
    } catch (UnsupportedOperationException expected) {
      return;
    }
    throw new AssertionError("teaser map must be unmodifiable");
  }

  @Test
  void teaserSanitizeAndTruncate() {
    assertThat(TeaserGuard.sanitize("  <i>x</i>  ")).isEqualTo("x");
    Map<String, Object> teaser = new LinkedHashMap<>();
    teaser.put("title", "t".repeat(200));
    teaser.put("summary", "s".repeat(400));
    PlanView view = TeaserGuard.filter(record(teaser, null), false);
    assertThat(((String) view.teaser().get("title")).length())
        .isEqualTo(TeaserGuard.TITLE_MAX);
    assertThat(((String) view.teaser().get("summary")).length())
        .isEqualTo(TeaserGuard.SUMMARY_MAX);
    assertThat(TeaserGuard.TEASER_ALLOWLIST)
        .containsExactlyInAnyOrder("title", "summary", "stepCount", "priceRange");
  }

  @Test
  void dtosShape() {
    PlanDtos.PlanResponse response =
        new PlanDtos.PlanResponse("p", 1, Map.of("t", 1), null);
    assertThat(response.id()).isEqualTo("p");
    assertThat(new PlanDtos.ReadjustAccepted("r", 1, "op").baseVersion()).isEqualTo(1);
  }
}
