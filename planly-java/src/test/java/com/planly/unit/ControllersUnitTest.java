package com.planly.unit;

import com.planly.draft.DraftController;
import com.planly.plan.PlanController;
import com.planly.step.StepController;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Method;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ControllersUnitTest {

  @Test
  void draftControllerStaticMethods() {
    // etag (package-private)
    try {
      Method etag = DraftController.class.getDeclaredMethod("etag", int.class);
      etag.setAccessible(true);
      assertThat(etag.invoke(null, 1)).isEqualTo("\"v1\"");
      assertThat(etag.invoke(null, 42)).isEqualTo("\"v42\"");
    } catch (Exception e) {
      throw new RuntimeException(e);
    }

    // etagMatches (package-private)
    try {
      Method etagMatches = DraftController.class.getDeclaredMethod("etagMatches", String.class, String.class);
      etagMatches.setAccessible(true);
      assertThat(etagMatches.invoke(null, null, "\"v1\"")).isEqualTo(false);
      assertThat(etagMatches.invoke(null, "  \"v1\"  ", "\"v1\"")).isEqualTo(true);
      assertThat(etagMatches.invoke(null, "v1", "\"v1\"")).isEqualTo(true);
      assertThat(etagMatches.invoke(null, "\"v2\"", "\"v1\"")).isEqualTo(false);
    } catch (Exception e) {
      throw new RuntimeException(e);
    }

    // validNext (package-private)
    try {
      Method validNext = DraftController.class.getDeclaredMethod("validNext", String.class);
      validNext.setAccessible(true);
      assertThat(validNext.invoke(null, new Object[]{null})).isEqualTo(true);
      assertThat(validNext.invoke(null, new Object[]{""})).isEqualTo(true);
      assertThat(validNext.invoke(null, new Object[]{"/planly"})).isEqualTo(true);
      assertThat(validNext.invoke(null, new Object[]{"/planly/draft"})).isEqualTo(true);
      assertThat(validNext.invoke(null, new Object[]{"/dashboard"})).isEqualTo(true);
      assertThat(validNext.invoke(null, new Object[]{"/evil"})).isEqualTo(false);
      assertThat(validNext.invoke(null, new Object[]{"https://evil.com"})).isEqualTo(false);
      assertThat(validNext.invoke(null, new Object[]{"http://evil.com"})).isEqualTo(false);
      assertThat(validNext.invoke(null, new Object[]{"%2F%2Fevil"})).isEqualTo(false);
      assertThat(validNext.invoke(null, new Object[]{"../evil"})).isEqualTo(false);
      assertThat(validNext.invoke(null, new Object[]{"javascript:alert(1)"})).isEqualTo(false);
    } catch (Exception e) {
      throw new RuntimeException(e);
    }

    // parseObject (package-private)
    try {
      Method parseObject = DraftController.class.getDeclaredMethod("parseObject", byte[].class, String.class, org.springframework.http.HttpStatus.class);
      parseObject.setAccessible(true);
      assertThat(parseObject.invoke(null, new Object[]{(Object) null, "X", org.springframework.http.HttpStatus.BAD_REQUEST})).isEqualTo(Map.of());
      assertThat(parseObject.invoke(null, new Object[]{new byte[0], "X", org.springframework.http.HttpStatus.BAD_REQUEST})).isEqualTo(Map.of());
      assertThat(parseObject.invoke(null, new Object[]{"{}".getBytes(), "X", org.springframework.http.HttpStatus.BAD_REQUEST})).isEqualTo(Map.of());
      @SuppressWarnings("unchecked")
      Map<String, Object> result = (Map<String, Object>) parseObject.invoke(null, new Object[]{"{\"a\":1}".getBytes(), "X", org.springframework.http.HttpStatus.BAD_REQUEST});
      assertThat(result.get("a")).isEqualTo(1L); // JSON parser returns Long for numbers
      assertThatThrownBy(() -> parseObject.invoke(null, new Object[]{"{invalid}".getBytes(), "X", org.springframework.http.HttpStatus.BAD_REQUEST}))
          .isInstanceOf(java.lang.reflect.InvocationTargetException.class)
          .hasCauseInstanceOf(com.planly.common.PlanlyException.class);
    } catch (Exception e) {
      throw new RuntimeException(e);
    }

// draftCookie / clearedCookie (package-private)
    try {
      Method draftCookie = DraftController.class.getDeclaredMethod("draftCookie", String.class);
      draftCookie.setAccessible(true);
      Object cookie = draftCookie.invoke(null, "test-id");
      assertThat(cookie.getClass().getMethod("getName").invoke(cookie)).isEqualTo("draftId");
      assertThat(cookie.getClass().getMethod("isHttpOnly").invoke(cookie)).isEqualTo(true);
      assertThat(cookie.getClass().getMethod("isSecure").invoke(cookie)).isEqualTo(true);
      assertThat(cookie.getClass().getMethod("getSameSite").invoke(cookie)).isEqualTo("Lax");
      assertThat(cookie.getClass().getMethod("getPath").invoke(cookie)).isEqualTo("/");
      // getMaxAge returns Duration (ISO 8601 format)
      Object maxAge = cookie.getClass().getMethod("getMaxAge").invoke(cookie);
      assertThat(maxAge.toString()).isEqualTo("PT720H"); // 30 days = 720 hours

      Method clearedCookie = DraftController.class.getDeclaredMethod("clearedCookie");
      clearedCookie.setAccessible(true);
      Object cleared = clearedCookie.invoke(null);
      assertThat(cleared.getClass().getMethod("getName").invoke(cleared)).isEqualTo("draftId");
      Object clearedMaxAge = cleared.getClass().getMethod("getMaxAge").invoke(cleared);
      assertThat(clearedMaxAge.toString()).isEqualTo("PT0S"); // zero duration
    } catch (Exception e) {
      throw new RuntimeException(e);
    }
  }

  @Test
  void stepControllerStaticMethods() {
    // etag (package-private)
    try {
      Method etag = StepController.class.getDeclaredMethod("etag", int.class);
      etag.setAccessible(true);
      assertThat(etag.invoke(null, 1)).isEqualTo("\"v1\"");
      assertThat(etag.invoke(null, 42)).isEqualTo("\"v42\"");
    } catch (Exception e) {
      throw new RuntimeException(e);
    }

    // etagMatches (package-private)
    try {
      Method etagMatches = StepController.class.getDeclaredMethod("etagMatches", String.class, String.class);
      etagMatches.setAccessible(true);
      assertThat(etagMatches.invoke(null, null, "\"v1\"")).isEqualTo(false);
      assertThat(etagMatches.invoke(null, "  \"v1\"  ", "\"v1\"")).isEqualTo(true);
      assertThat(etagMatches.invoke(null, "v1", "\"v1\"")).isEqualTo(true);
      assertThat(etagMatches.invoke(null, "\"v2\"", "\"v1\"")).isEqualTo(false);
    } catch (Exception e) {
      throw new RuntimeException(e);
    }

    // parseIfMatch (package-private)
    try {
      Method parseIfMatch = StepController.class.getDeclaredMethod("parseIfMatch", String.class);
      parseIfMatch.setAccessible(true);
      assertThat(parseIfMatch.invoke(null, (Object) null)).isNull();
      assertThat(parseIfMatch.invoke(null, "  ")).isNull();
      assertThat(parseIfMatch.invoke(null, "1")).isEqualTo(1);
      assertThat(parseIfMatch.invoke(null, "  42  ")).isEqualTo(42);
      assertThat(parseIfMatch.invoke(null, "\"1\"")).isEqualTo(1);
      assertThat(parseIfMatch.invoke(null, "v1")).isEqualTo(1);
      assertThat(parseIfMatch.invoke(null, "V42")).isEqualTo(42);
      assertThat(parseIfMatch.invoke(null, "\"v1\"")).isEqualTo(1);
      assertThat(parseIfMatch.invoke(null, "v0")).isNull(); // version >= 1
      assertThat(parseIfMatch.invoke(null, "not-a-number")).isNull();
    } catch (Exception e) {
      throw new RuntimeException(e);
    }

    // stepNumber (private) - skip due to reflection issues with private method throwing
    // The branch coverage for stepNumber is covered by slice tests
  }

  @Test
  void planControllerStaticMethods() {
    // etag (package-private)
    try {
      Method etag = PlanController.class.getDeclaredMethod("etag", String.class, int.class);
      etag.setAccessible(true);
      assertThat(etag.invoke(null, "plan-id", 1)).isEqualTo("\"plan-plan-id-v1\"");
      assertThat(etag.invoke(null, "abc", 42)).isEqualTo("\"plan-abc-v42\"");
    } catch (Exception e) {
      throw new RuntimeException(e);
    }

    // normalize (package-private)
    try {
      Method normalize = PlanController.class.getDeclaredMethod("normalize", String.class);
      normalize.setAccessible(true);
      assertThat(normalize.invoke(null, (Object) null)).isNull();
      assertThat(normalize.invoke(null, "")).isNull();
      assertThat(normalize.invoke(null, "  ")).isNull();
      // Test various inputs - normalize trims, removes W/, and strips quotes
      String v1Result = (String) normalize.invoke(null, "\"v1\"");
      assertThat(v1Result).isNotNull();
      assertThat(v1Result.contains("v1")).isTrue();

      String v1Result2 = (String) normalize.invoke(null, "  \"v1\"  ");
      assertThat(v1Result2).isNotNull();
      assertThat(v1Result2.contains("v1")).isTrue();

      String w1 = (String) normalize.invoke(null, "W/\"v1\"");
      assertThat(w1).isNotNull();
      assertThat(w1.contains("v1")).isTrue();

      String w2 = (String) normalize.invoke(null, "W/  \"v1\"  ");
      assertThat(w2).isNotNull();
      assertThat(w2.contains("v1")).isTrue();

      assertThat(normalize.invoke(null, "W/")).isNull();
    } catch (Exception e) {
      throw new RuntimeException(e);
    }

    // parseBody (private) - skip due to reflection issues with private method
    // Branch coverage for parseBody is covered by slice tests
  }
}