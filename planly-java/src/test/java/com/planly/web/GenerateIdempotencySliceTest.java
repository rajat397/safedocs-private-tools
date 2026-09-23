package com.planly.web;

import java.util.Set;

import com.planly.draft.DraftStore;
import com.planly.ent.EntitlementService;
import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.anyOf;
import static org.hamcrest.Matchers.is;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Matrix: generate 202 vs 200 replay (same opId), 409 STEP_STALE, 422
 * STEP_INCOMPLETE, 402 entitlement choke C1, 410 on discarded draft,
 * operation polling 200/401/403/404.
 */
@WebMvcTest
class GenerateIdempotencySliceTest {

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
  void firstGenerate202Replay200SameOpId() throws Exception {
    DraftStore.Draft draft = readyDraft();

    MvcResult first = mvc.perform(post("/v1/drafts/" + draft.id() + "/generate")
            .header("Authorization", SliceSupport.bearer(SliceSupport.ALICE_TOKEN))
            .header("Idempotency-Key", SliceSupport.KEY_A)
            .contentType(MediaType.APPLICATION_JSON)
            .content("{}"))
        .andExpect(status().isAccepted())
        .andExpect(jsonPath("$.opId").isNotEmpty())
        .andExpect(jsonPath("$.status").value("accepted"))
        .andReturn();
    String opId = JsonPath.read(
        first.getResponse().getContentAsString(), "$.opId");

    mvc.perform(post("/v1/drafts/" + draft.id() + "/generate")
            .header("Authorization", SliceSupport.bearer(SliceSupport.ALICE_TOKEN))
            .header("Idempotency-Key", SliceSupport.KEY_A)
            .contentType(MediaType.APPLICATION_JSON)
            .content("{}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.opId").value(opId));
  }

  @Test
  void badIdempotencyKeyIs400() throws Exception {
    DraftStore.Draft draft = readyDraft();
    mvc.perform(post("/v1/drafts/" + draft.id() + "/generate")
            .header("Authorization", SliceSupport.bearer(SliceSupport.ALICE_TOKEN))
            .header("Idempotency-Key", "not-a-uuid")
            .contentType(MediaType.APPLICATION_JSON)
            .content("{}"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("BAD_IDEMPOTENCY_KEY"));

    mvc.perform(post("/v1/drafts/" + draft.id() + "/generate")
            .header("Authorization", SliceSupport.bearer(SliceSupport.ALICE_TOKEN))
            .contentType(MediaType.APPLICATION_JSON)
            .content("{}"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("BAD_IDEMPOTENCY_KEY"));
  }

  @Test
  void staleSnapshotIs409() throws Exception {
    DraftStore.Draft draft = readyDraft();
    mvc.perform(post("/v1/drafts/" + draft.id() + "/generate")
            .header("Authorization", SliceSupport.bearer(SliceSupport.ALICE_TOKEN))
            .header("Idempotency-Key", SliceSupport.KEY_B)
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"stepSnapshotVersion\":999}"))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("STEP_STALE"))
        .andExpect(jsonPath("$.currentVersion").value(draft.version()));
  }

  @Test
  void incompleteStepsIs422() throws Exception {
    DraftStore.Draft draft = SliceSupport.aliceDraft();
    mvc.perform(post("/v1/drafts/" + draft.id() + "/generate")
            .header("Authorization", SliceSupport.bearer(SliceSupport.ALICE_TOKEN))
            .header("Idempotency-Key", SliceSupport.KEY_A)
            .contentType(MediaType.APPLICATION_JSON)
            .content("{}"))
        .andExpect(status().isUnprocessableEntity())
        .andExpect(jsonPath("$.code").value("STEP_INCOMPLETE"));
  }

  @Test
  void entitlementDenyIs402() throws Exception {
    EntitlementService.setDenyOverride(Set.of("generate"));
    DraftStore.Draft draft = readyDraft();
    mvc.perform(post("/v1/drafts/" + draft.id() + "/generate")
            .header("Authorization", SliceSupport.bearer(SliceSupport.ALICE_TOKEN))
            .header("Idempotency-Key", SliceSupport.KEY_A)
            .contentType(MediaType.APPLICATION_JSON)
            .content("{}"))
        .andExpect(status().isPaymentRequired())
        .andExpect(jsonPath("$.code").value("ENTITLEMENT_REQUIRED"));
  }

  @Test
  void generateOnDiscardedDraftIs410() throws Exception {
    DraftStore.Draft draft = readyDraft();
    DraftStore.discard(draft.id(), System.currentTimeMillis());
    mvc.perform(post("/v1/drafts/" + draft.id() + "/generate")
            .header("Authorization", SliceSupport.bearer(SliceSupport.ALICE_TOKEN))
            .header("Idempotency-Key", SliceSupport.KEY_A)
            .contentType(MediaType.APPLICATION_JSON)
            .content("{}"))
        .andExpect(status().isGone())
        .andExpect(jsonPath("$.code").value("DISCARDED"));
  }

  @Test
  void operationPollMatrix() throws Exception {
    DraftStore.Draft draft = readyDraft();
    MvcResult accepted = mvc.perform(post("/v1/drafts/" + draft.id() + "/generate")
            .header("Authorization", SliceSupport.bearer(SliceSupport.ALICE_TOKEN))
            .header("Idempotency-Key", SliceSupport.KEY_A)
            .contentType(MediaType.APPLICATION_JSON)
            .content("{}"))
        .andExpect(status().isAccepted())
        .andReturn();
    String opId = JsonPath.read(
        accepted.getResponse().getContentAsString(), "$.opId");
    assertThat(opId).isNotBlank();

    mvc.perform(get("/v1/operations/" + opId)
            .header("Authorization", SliceSupport.bearer(SliceSupport.ALICE_TOKEN)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.opId").value(opId))
        .andExpect(jsonPath("$.status",
            anyOf(is("accepted"), is("running"), is("succeeded"))));

    mvc.perform(get("/v1/operations/" + opId))
        .andExpect(status().isUnauthorized());

    mvc.perform(get("/v1/operations/" + opId)
            .header("Authorization", SliceSupport.bearer(SliceSupport.BOB_TOKEN)))
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.code").value("FORBIDDEN"));

    mvc.perform(get("/v1/operations/does-not-exist")
            .header("Authorization", SliceSupport.bearer(SliceSupport.ALICE_TOKEN)))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("NOT_FOUND"));
  }
}
