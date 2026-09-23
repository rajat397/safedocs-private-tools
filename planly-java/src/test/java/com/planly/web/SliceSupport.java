package com.planly.web;

import java.util.List;
import java.util.Map;

import com.fasterxml.jackson.core.type.TypeReference;
import com.planly.auth.JwtVerifier;
import com.planly.draft.DraftStore;
import com.planly.ent.EntitlementService;
import com.planly.gen.OpStore;
import com.planly.plan.PlanStore;
import com.planly.common.WarmupState;
import com.planly.rate.RateLimitService;
import com.planly.step.StepStore;

import jakarta.servlet.http.Cookie;

/**
 * Shared setup for MockMvc slice tests (no DB): resets every in-memory lane
 * and pins JWT verification to fixed test tokens. No secrets anywhere.
 */
public final class SliceSupport {

  public static final String ALICE_TOKEN = "tok-alice";
  public static final String ALICE = "user-alice";
  public static final String BOB_TOKEN = "tok-bob";
  public static final String BOB = "user-bob";

  /** Valid UUIDv4 idempotency keys (strict pattern, else 400). */
  public static final String KEY_A = "11111111-1111-4111-8111-111111111111";
  public static final String KEY_B = "22222222-2222-4222-8222-222222222222";
  public static final String KEY_C = "33333333-3333-4333-8333-333333333333";

  private SliceSupport() {
  }

  public static void resetAll() {
    DraftStore.resetForTests();
    StepStore.resetForTests();
    PlanStore.resetForTests();
    OpStore.resetForTests();
    RateLimitService.resetForTests();
    EntitlementService.resetForTests();
    JwtVerifier.resetForTests();
    WarmupState.setColdForTests(false);
  }

  /** Maps ALICE_TOKEN->ALICE, BOB_TOKEN->BOB; anything else is forged (401). */
  public static void authMock() {
    JwtVerifier.setTestVerifier(token -> switch (token) {
      case ALICE_TOKEN -> ALICE;
      case BOB_TOKEN -> BOB;
      default -> null;
    });
  }

  public static Cookie draftCookie(String draftId) {
    return new Cookie("draftId", draftId);
  }

  public static String bearer(String token) {
    return "Bearer " + token;
  }

  /** Fresh anon draft (owner null, holder = cookie). */
  public static DraftStore.Draft anonDraft() {
    return DraftStore.create(null, System.currentTimeMillis());
  }

  /** Fresh draft owned by Alice. */
  public static DraftStore.Draft aliceDraft() {
    return DraftStore.create(ALICE, System.currentTimeMillis());
  }

  /** Step-1 payload row (direct store put, no draft-version bump). */
  public static void step1Payload(String draftId, Map<String, Object> payload) {
    StepStore.put(draftId, 1,
        payload == null ? Map.of("planName", "Algebra") : payload,
        1, System.currentTimeMillis());
  }

  /** Materialise plan v1 for a draft (teaser + full). */
  public static PlanStore.PlanRecord materialise(String draftId) {
    return PlanStore.materialise(draftId, System.currentTimeMillis());
  }

  /** Load track seed tasks for tests (mirrors TrackSeedLoader). */
  public static void loadTrackTasks() {
    try (var is = SliceSupport.class.getClassLoader()
        .getResourceAsStream("planly/tracks-hireable-v2.json")) {
      if (is == null) {
        throw new IllegalStateException("Seed not found on classpath: planly/tracks-hireable-v2.json");
      }
      var mapper = new com.fasterxml.jackson.databind.ObjectMapper();
      @SuppressWarnings("unchecked")
      List<Map<String, Object>> tasks = mapper.readValue(is, new TypeReference<List<Map<String, Object>>>() {});
      for (Map<String, Object> t : tasks) {
        StepStore.putTrackTask(
            (String) t.get("track"),
            (String) t.get("level"),
            t
        );
      }
    } catch (Exception e) {
      throw new IllegalStateException("Failed to load track seed for tests", e);
    }
  }
}
