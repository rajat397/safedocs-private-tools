package com.planly.draft;

import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Unit coverage for draft cookie shaping, next-allowlist and body parsing.
 */
class DraftControllerStaticsTest {

  @Test
  void cookies() {
    assertThat(DraftController.draftCookie("abc").toString())
        .contains("draftId=abc").contains("HttpOnly").contains("Path=/");
    assertThat(DraftController.clearedCookie().toString()).contains("Max-Age=0");
  }

  @Test
  void nextAllowlist() {
    assertThat(DraftController.validNext(null)).isTrue();
    assertThat(DraftController.validNext("")).isTrue();
    assertThat(DraftController.validNext("/planly")).isTrue();
    assertThat(DraftController.validNext("/planly/draft")).isTrue();
    assertThat(DraftController.validNext("/dashboard")).isTrue();
    assertThat(DraftController.validNext("/elsewhere")).isFalse();
    assertThat(DraftController.validNext("https://evil.example")).isFalse();
    assertThat(DraftController.validNext("//evil")).isFalse();
    assertThat(DraftController.validNext("/planly/../x")).isFalse();
    assertThat(DraftController.validNext("%2f%2f evil")).isFalse();
    assertThat(DraftController.validNext("%")).isFalse();
  }

  @Test
  void parseObject() {
    assertThat(DraftController.parseObject(null, "C", HttpStatus.BAD_REQUEST)).isEmpty();
    assertThat(DraftController.parseObject(new byte[0], "C", HttpStatus.BAD_REQUEST))
        .isEmpty();
    assertThat(DraftController.parseObject("{\"a\":1}".getBytes(), "C",
        HttpStatus.BAD_REQUEST)).containsEntry("a", 1L);
    assertThatThrownBy(() -> DraftController.parseObject("{bad".getBytes(), "C",
        HttpStatus.BAD_REQUEST)).hasMessage("C");
  }

  @Test
  void rateLimitedCarrier() {
    try {
      DraftController.rateLimited(9L);
    } catch (com.planly.common.RateLimited rate) {
      assertThat(rate.retryAfter()).isEqualTo(9L);
      return;
    }
    throw new AssertionError("expected RateLimited");
  }

  @Test
  void dtosShape() {
    DraftDtos.DraftResponse draft = new DraftDtos.DraftResponse("id", 1, "open");
    assertThat(draft.id()).isEqualTo("id");
    assertThat(new DraftDtos.BindResponse("id", "u", true).merged()).isTrue();
    assertThat(new DraftDtos.DiscardResponse("id", "discarded").status())
        .isEqualTo("discarded");
    assertThat(Map.of("k", draft)).containsKey("k");
  }
}
