package com.planly.web;

import java.lang.reflect.Method;

import com.planly.draft.DraftStore;
import com.planly.gen.OpStore;
import com.planly.rate.RateLimitService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Branch-gap slice coverage for the generate lane
 * ({@code GenerateController}) and operation polling
 * ({@code OperationController}): auth ordering, snapshot aliases,
 * non-numeric snapshots, malformed bodies, expired keys, throttle,
 * discarded/missing drafts, op expiry and the async finisher.
 */
@WebMvcTest
class BranchGapSliceTest {

  @Autowired
  private MockMvc mvc;

  @BeforeEach
  void setUp() {
    SliceSupport.resetAll();
    SliceSupport.authMock();
  }

  @AfterEach
  void tearDown() {
    SliceSupport.resetAll();
  }

  private DraftStore.Draft readyDraft() {
    DraftStore.Draft draft = SliceSupport.aliceDraft();
    SliceSupport.step1Payload(draft.id(), null);
    return draft;
  }

  @Test
  void generateMissingDraftIs404() throws Exception {
    mvc.perform(post("/v1/drafts/does-not-exist/generate")
            .header("Authorization", SliceSupport.bearer(SliceSupport.ALICE_TOKEN))
            .header("Idempotency-Key", SliceSupport.KEY_A)
            .contentType(MediaType.APPLICATION_JSON)
            .content("{}"))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("NOT_FOUND"));
  }

  @Test
  void generateUnauthenticatedIs401() throws Exception {
    DraftStore.Draft draft = SliceSupport.aliceDraft();
    SliceSupport.step1Payload(draft.id(), null);
    mvc.perform(post("/v1/drafts/" + draft.id() + "/generate")
            .header("Idempotency-Key", SliceSupport.KEY_A)
            .contentType(MediaType.APPLICATION_JSON)
            .content("{}"))
        .andExpect(status().isUnauthorized())
        .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
  }

  @Test
  void generateForeignIs403() throws Exception {
    DraftStore.Draft draft = readyDraft();
    mvc.perform(post("/v1/drafts/" + draft.id() + "/generate")
            .header("Authorization", SliceSupport.bearer(SliceSupport.BOB_TOKEN))
            .header("Idempotency-Key", SliceSupport.KEY_A)
            .contentType(MediaType.APPLICATION_JSON)
            .content("{}"))
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.code").value("FORBIDDEN"));
  }

  @Test
  void generateAnonDraftWithoutEntitlementIs402() throws Exception {
    DraftStore.Draft draft = SliceSupport.anonDraft();
    SliceSupport.step1Payload(draft.id(), null);
    mvc.perform(post("/v1/drafts/" + draft.id() + "/generate")
            .cookie(SliceSupport.draftCookie(draft.id()))
            .header("Idempotency-Key", SliceSupport.KEY_A)
            .contentType(MediaType.APPLICATION_JSON)
            .content("{}"))
        .andExpect(status().isPaymentRequired())
        .andExpect(jsonPath("$.code").value("ENTITLEMENT_REQUIRED"));
  }

  @Test
  void generateSnapshotAliasesStale409() throws Exception {
    DraftStore.Draft draft = readyDraft();
    mvc.perform(post("/v1/drafts/" + draft.id() + "/generate")
            .header("Authorization", SliceSupport.bearer(SliceSupport.ALICE_TOKEN))
            .header("Idempotency-Key", SliceSupport.KEY_A)
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"snapshotVersion\":999}"))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("STEP_STALE"));

    mvc.perform(post("/v1/drafts/" + draft.id() + "/generate")
            .header("Authorization", SliceSupport.bearer(SliceSupport.ALICE_TOKEN))
            .header("Idempotency-Key", SliceSupport.KEY_B)
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"version\":999}"))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("STEP_STALE"));
  }

  @Test
  void generateMatchingSnapshotVersionIs202() throws Exception {
    DraftStore.Draft draft = readyDraft();
    mvc.perform(post("/v1/drafts/" + draft.id() + "/generate")
            .header("Authorization", SliceSupport.bearer(SliceSupport.ALICE_TOKEN))
            .header("Idempotency-Key", SliceSupport.KEY_C)
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"snapshotVersion\":" + draft.version() + "}"))
        .andExpect(status().isAccepted())
        .andExpect(jsonPath("$.opId").isNotEmpty());
  }

  @Test
  void generateStringSnapshotSkipsStaleCheck() throws Exception {
    DraftStore.Draft draft = readyDraft();
    mvc.perform(post("/v1/drafts/" + draft.id() + "/generate")
            .header("Authorization", SliceSupport.bearer(SliceSupport.ALICE_TOKEN))
            .header("Idempotency-Key", SliceSupport.KEY_B)
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"stepSnapshotVersion\":\"v1\"}"))
        .andExpect(status().isAccepted())
        .andExpect(jsonPath("$.opId").isNotEmpty());
  }

  @Test
  void generateMalformedJsonIs400() throws Exception {
    DraftStore.Draft draft = readyDraft();
    mvc.perform(post("/v1/drafts/" + draft.id() + "/generate")
            .header("Authorization", SliceSupport.bearer(SliceSupport.ALICE_TOKEN))
            .header("Idempotency-Key", SliceSupport.KEY_A)
            .contentType(MediaType.APPLICATION_JSON)
            .content("{bad"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("BAD_REQUEST"));
  }

  @Test
  void generateExpiredKeyIs410() throws Exception {
    DraftStore.Draft draft = readyDraft();
    OpStore.create(draft.id(), SliceSupport.KEY_A, 0L, () -> {
    });
    mvc.perform(post("/v1/drafts/" + draft.id() + "/generate")
            .header("Authorization", SliceSupport.bearer(SliceSupport.ALICE_TOKEN))
            .header("Idempotency-Key", SliceSupport.KEY_A)
            .contentType(MediaType.APPLICATION_JSON)
            .content("{}"))
        .andExpect(status().isGone())
        .andExpect(jsonPath("$.code").value("OP_GONE"));
  }

  @Test
  void generateThrottleIs429() throws Exception {
    long now = System.currentTimeMillis();
    for (int i = 0; i < RateLimitService.PUT_PER_IP_PER_MIN; i++) {
      RateLimitService.checkPutByIp("127.0.0.1", now);
    }
    DraftStore.Draft draft = readyDraft();
    mvc.perform(post("/v1/drafts/" + draft.id() + "/generate")
            .header("Authorization", SliceSupport.bearer(SliceSupport.ALICE_TOKEN))
            .header("Idempotency-Key", SliceSupport.KEY_A)
            .contentType(MediaType.APPLICATION_JSON)
            .content("{}"))
        .andExpect(status().isTooManyRequests())
        .andExpect(jsonPath("$.code").value("RATE_LIMITED"));
  }

  @Test
  void operationExpiredIs410() throws Exception {
    OpStore.Operation op = OpStore.create("any-draft", SliceSupport.KEY_A, 0L,
        () -> {
        });
    mvc.perform(get("/v1/operations/" + op.opId())
            .header("Authorization", SliceSupport.bearer(SliceSupport.ALICE_TOKEN)))
        .andExpect(status().isGone())
        .andExpect(jsonPath("$.code").value("OP_GONE"));
  }

  @Test
  void operationUnknownDraftIs404() throws Exception {
    OpStore.Operation op = OpStore.create("no-such-draft", SliceSupport.KEY_A,
        System.currentTimeMillis(), () -> {
        });
    mvc.perform(get("/v1/operations/" + op.opId())
            .header("Authorization", SliceSupport.bearer(SliceSupport.ALICE_TOKEN)))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("NOT_FOUND"));
  }

  @Test
  void operationDiscardedDraftIs410() throws Exception {
    DraftStore.Draft draft = readyDraft();
    OpStore.Operation op = OpStore.create(draft.id(), SliceSupport.KEY_A,
        System.currentTimeMillis(), () -> {
        });
    DraftStore.discard(draft.id(), System.currentTimeMillis());
    mvc.perform(get("/v1/operations/" + op.opId())
            .header("Authorization", SliceSupport.bearer(SliceSupport.ALICE_TOKEN)))
        .andExpect(status().isGone())
        .andExpect(jsonPath("$.code").value("DISCARDED"));
  }

  @Test
  void operationFinisherCompletesWithPlan() throws Exception {
    DraftStore.Draft draft = readyDraft();
    mvc.perform(post("/v1/drafts/" + draft.id() + "/generate")
            .header("Authorization", SliceSupport.bearer(SliceSupport.ALICE_TOKEN))
            .header("Idempotency-Key", SliceSupport.KEY_A)
            .contentType(MediaType.APPLICATION_JSON)
            .content("{}"))
        .andExpect(status().isAccepted());
    String opId = OpStore.byKey(draft.id(), SliceSupport.KEY_A,
        System.currentTimeMillis()) instanceof OpStore.Live.Found found
            ? found.op().opId() : null;
    assertThat(opId).isNotBlank();
    Thread.sleep(1000L);
    mvc.perform(get("/v1/operations/" + opId)
            .header("Authorization", SliceSupport.bearer(SliceSupport.ALICE_TOKEN)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.opId").value(opId))
        .andExpect(jsonPath("$.status").value("succeeded"))
        .andExpect(jsonPath("$.planId").isNotEmpty());
  }

  @Test
  void finisherEarlyReturns() throws Exception {
    Method finish = Class.forName("com.planly.gen.GenerateController")
        .getDeclaredMethod("finish", String.class, String.class);
    finish.setAccessible(true);
    Object controller = Class.forName("com.planly.gen.GenerateController")
        .getDeclaredConstructor().newInstance();
    // Missing key: byKey is Missing -> early return, no throw.
    finish.invoke(controller, "no-draft", "no-key");

    // Succeeded op: status gate -> early return, no throw.
    DraftStore.Draft draft = readyDraft();
    OpStore.Operation op = OpStore.create(draft.id(), SliceSupport.KEY_B,
        System.currentTimeMillis(), () -> {
        });
    OpStore.complete(op.opId(), "p1", 1, System.currentTimeMillis());
    finish.invoke(controller, draft.id(), SliceSupport.KEY_B);
  }
}
