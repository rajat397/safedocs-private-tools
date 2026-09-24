package com.planly.unit;

import com.planly.plan.PlanStore;
import com.planly.plan.TeaserGuard;
import com.planly.plan.PlanView;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Method;
import java.util.LinkedHashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class PlanTeaserUnitTest {

  @BeforeEach
  void reset() {
    PlanStore.resetForTests();
  }

  @Test
  void teaserGuardFilterBranchCoverage() {
    // Test teaser mode (canReadFull = false)
    Map<String, Object> teaser = new LinkedHashMap<>();
    teaser.put("title", "  <b>Test Plan</b>  ");
    teaser.put("summary", "  <i>Summary</i>  ");
    teaser.put("stepCount", 3);
    teaser.put("priceRange", "$10-20");
    teaser.put("extraField", "should not appear");

    Map<String, Object> full = new LinkedHashMap<>();
    full.put("sprints", new java.util.ArrayList<>());
    full.put("metrics", Map.of("progress", Map.of("done", 1, "total", 10)));

    PlanStore.PlanRecord plan = new PlanStore.PlanRecord(
        "plan-1", "draft-1", 1, teaser, full, System.currentTimeMillis());

    PlanView view = TeaserGuard.filter(plan, false);
    assertThat(view).isInstanceOf(PlanView.Teaser.class);
    PlanView.Teaser teaserView = (PlanView.Teaser) view;
    assertThat(teaserView.teaser()).containsEntry("title", "Test Plan");
    assertThat(teaserView.teaser()).containsEntry("summary", "Summary");
    assertThat(teaserView.teaser()).containsEntry("stepCount", 3);
    assertThat(teaserView.teaser()).containsEntry("priceRange", "$10-20");
    assertThat(teaserView.teaser()).doesNotContainKey("extraField");

    // Test full mode (canReadFull = true)
    PlanView fullView = TeaserGuard.filter(plan, true);
    assertThat(fullView).isInstanceOf(PlanView.Full.class);
    PlanView.Full fullPlan = (PlanView.Full) fullView;
    assertThat(fullPlan.full()).isNotNull();
    assertThat(fullPlan.full()).containsKey("sprints");
    assertThat(fullPlan.full()).containsKey("metrics");

    // Test with null full
    PlanStore.PlanRecord planNoFull = new PlanStore.PlanRecord(
        "plan-2", "draft-2", 1, teaser, null, System.currentTimeMillis());
    PlanView teaserOnly = TeaserGuard.filter(planNoFull, false);
    assertThat(teaserOnly).isInstanceOf(PlanView.Teaser.class);

    PlanView fullOnly = TeaserGuard.filter(planNoFull, true);
    assertThat(fullOnly).isInstanceOf(PlanView.Full.class);
    PlanView.Full fullNoFull = (PlanView.Full) fullOnly;
    assertThat(fullNoFull.full()).isNull();
  }

  @Test
  void teaserGuardSanitizeTruncateBranchCoverage() {
    // sanitize (package-private)
    try {
      Method sanitize = TeaserGuard.class.getDeclaredMethod("sanitize", String.class);
      sanitize.setAccessible(true);
      assertThat(sanitize.invoke(null, "Hello World")).isEqualTo("Hello World");
      assertThat(sanitize.invoke(null, "  <script>alert(1)</script>  ")).isEqualTo("alert(1)");
      assertThat(sanitize.invoke(null, "<b>Bold</b> <i>Italic</i>")).isEqualTo("Bold Italic");
    } catch (Exception e) {
      throw new RuntimeException(e);
    }

    // truncate (private) - returns substring(0, max) which includes the character at max-1
    try {
      Method truncate = TeaserGuard.class.getDeclaredMethod("truncate", String.class, int.class);
      truncate.setAccessible(true);
      assertThat(truncate.invoke(null, "short", 10)).isEqualTo("short");
      assertThat(truncate.invoke(null, "very long text here", 10)).isEqualTo("very long ");
    } catch (Exception e) {
      throw new RuntimeException(e);
    }
  }
}