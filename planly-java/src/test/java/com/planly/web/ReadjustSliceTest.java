package com.planly.web;

import java.util.Set;

import com.jayway.jsonpath.JsonPath;
import com.planly.draft.DraftStore;
import com.planly.ent.EntitlementService;
import com.planly.plan.PlanStore;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Matrix: readjust 201 (both path spellings), replay 200 with identical ids,
 * 409 STALE_BASE, 400 missing/bad key, 422 bad delta, 413 oversize, 402 deny.
 */
@WebMvcTest
class ReadjustSliceTest {

  @Autowired
  private MockMvc mvc;

  @BeforeEach
  void setUp() {
    SliceSupport.resetAll();
    SliceSupport.authMock();
    SliceSupport.loadTrackTasks();
  }

  @AfterEach
  void tearDown() {
    SliceSupport.resetAll();
  }

  private PlanStore.PlanRecord readyPlan() {
    DraftStore.Draft draft = SliceSupport.aliceDraft();
    SliceSupport.step1Payload(draft.id(), null);
    return SliceSupport.materialise(draft.id());
  }

  private static String body(int baseVersion, String missedDate) {
    return "{\"baseVersion\":" + baseVersion
        + ",\"delta\":{\"missedDate\":\"" + missedDate + "\"}}";
  }

  @Test
  void readjust201AndReplay200Identical() throws Exception {
    PlanStore.PlanRecord plan = readyPlan();

    MvcResult first = mvc.perform(
            post("/v1/plans/" + plan.id() + "/readjustments")
                .header("Authorization", SliceSupport.bearer(SliceSupport.ALICE_TOKEN))
                .header("Idempotency-Key", SliceSupport.KEY_A)
                .contentType(MediaType.APPLICATION_JSON)
                .content(body(1, "2026-09-01")))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.readjustmentId").isNotEmpty())
        .andExpect(jsonPath("$.baseVersion").value(1))
        .andExpect(jsonPath("$.opId").isNotEmpty())
        .andReturn();
    String readjustmentId =
        JsonPath.read(first.getResponse().getContentAsString(), "$.readjustmentId");
    String opId = JsonPath.read(first.getResponse().getContentAsString(), "$.opId");

    mvc.perform(post("/v1/plans/" + plan.id() + "/readjustments")
            .header("Authorization", SliceSupport.bearer(SliceSupport.ALICE_TOKEN))
            .header("Idempotency-Key", SliceSupport.KEY_A)
            .contentType(MediaType.APPLICATION_JSON)
            .content(body(1, "2026-09-01")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.readjustmentId").value(readjustmentId))
        .andExpect(jsonPath("$.opId").value(opId));
    assertThat(readjustmentId).isNotBlank();
  }

  @Test
  void legacySingularPathAlso201() throws Exception {
    PlanStore.PlanRecord plan = readyPlan();
    mvc.perform(post("/v1/plans/" + plan.id() + "/readjust")
            .header("Authorization", SliceSupport.bearer(SliceSupport.ALICE_TOKEN))
            .header("Idempotency-Key", SliceSupport.KEY_C)
            .contentType(MediaType.APPLICATION_JSON)
            .content(body(1, "2026-09-02")))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.baseVersion").value(1));
  }

  @Test
  void staleBaseIs409() throws Exception {
    PlanStore.PlanRecord plan = readyPlan();
    mvc.perform(post("/v1/plans/" + plan.id() + "/readjustments")
            .header("Authorization", SliceSupport.bearer(SliceSupport.ALICE_TOKEN))
            .header("Idempotency-Key", SliceSupport.KEY_B)
            .contentType(MediaType.APPLICATION_JSON)
            .content(body(999, "2026-09-01")))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("STALE_BASE"))
        .andExpect(jsonPath("$.currentVersion").value(1));
  }

  @Test
  void missingKeyAndBaseAre400() throws Exception {
    PlanStore.PlanRecord plan = readyPlan();
    mvc.perform(post("/v1/plans/" + plan.id() + "/readjustments")
            .header("Authorization", SliceSupport.bearer(SliceSupport.ALICE_TOKEN))
            .contentType(MediaType.APPLICATION_JSON)
            .content(body(1, "2026-09-01")))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("BAD_IDEMPOTENCY_KEY"));

    mvc.perform(post("/v1/plans/" + plan.id() + "/readjustments")
            .header("Authorization", SliceSupport.bearer(SliceSupport.ALICE_TOKEN))
            .header("Idempotency-Key", SliceSupport.KEY_B)
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"delta\":{\"missedDate\":\"2026-09-01\"}}"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("MISSING_BASE_VERSION"));

    mvc.perform(post("/v1/plans/" + plan.id() + "/readjustments")
            .header("Authorization", SliceSupport.bearer(SliceSupport.ALICE_TOKEN))
            .header("Idempotency-Key", "bad-key")
            .contentType(MediaType.APPLICATION_JSON)
            .content(body(1, "2026-09-01")))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("BAD_IDEMPOTENCY_KEY"));
  }

  @Test
  void badDeltaIs422() throws Exception {
    PlanStore.PlanRecord plan = readyPlan();
    mvc.perform(post("/v1/plans/" + plan.id() + "/readjustments")
            .header("Authorization", SliceSupport.bearer(SliceSupport.ALICE_TOKEN))
            .header("Idempotency-Key", SliceSupport.KEY_B)
            .contentType(MediaType.APPLICATION_JSON)
            .content(body(1, "not-a-date")))
        .andExpect(status().isUnprocessableEntity())
        .andExpect(jsonPath("$.code").value("DELTA_INVALID"));

    mvc.perform(post("/v1/plans/" + plan.id() + "/readjustments")
            .header("Authorization", SliceSupport.bearer(SliceSupport.ALICE_TOKEN))
            .header("Idempotency-Key", SliceSupport.KEY_C)
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"baseVersion\":1}"))
        .andExpect(status().isUnprocessableEntity())
        .andExpect(jsonPath("$.code").value("DELTA_INVALID"));
  }

  @Test
  void oversizeDeltaIs413() throws Exception {
    PlanStore.PlanRecord plan = readyPlan();
    String big = "x".repeat(65 * 1024);
    mvc.perform(post("/v1/plans/" + plan.id() + "/readjustments")
            .header("Authorization", SliceSupport.bearer(SliceSupport.ALICE_TOKEN))
            .header("Idempotency-Key", SliceSupport.KEY_B)
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"baseVersion\":1,\"delta\":{\"missedDate\":\"2026-09-01\",\"pad\":\""
                + big + "\"}}"))
        .andExpect(status().isPayloadTooLarge());
  }

  @Test
  void entitlementDenyIs402() throws Exception {
    EntitlementService.setDenyOverride(Set.of("readjust"));
    PlanStore.PlanRecord plan = readyPlan();
    mvc.perform(post("/v1/plans/" + plan.id() + "/readjustments")
            .header("Authorization", SliceSupport.bearer(SliceSupport.ALICE_TOKEN))
            .header("Idempotency-Key", SliceSupport.KEY_A)
            .contentType(MediaType.APPLICATION_JSON)
            .content(body(1, "2026-09-01")))
        .andExpect(status().isPaymentRequired())
        .andExpect(jsonPath("$.code").value("ENTITLEMENT_REQUIRED"));
  }

  @Test
  void unauthenticatedIs401() throws Exception {
    PlanStore.PlanRecord plan = readyPlan();
    mvc.perform(post("/v1/plans/" + plan.id() + "/readjustments")
            .header("Idempotency-Key", SliceSupport.KEY_A)
            .contentType(MediaType.APPLICATION_JSON)
            .content(body(1, "2026-09-01")))
        .andExpect(status().isUnauthorized());
  }

  @Test
  void completionDeltaAdvancesProgress() throws Exception {
    PlanStore.PlanRecord plan = readyPlan();

    // First readjust with completion delta
    String body1 = "{\"baseVersion\":1,\"delta\":{\"taskId\":\"DSA-L0-01\",\"confidence\":4,\"evidence\":\"bigo_labels.txt score 5/5\"}}";
    MvcResult first = mvc.perform(
            post("/v1/plans/" + plan.id() + "/readjustments")
                .header("Authorization", SliceSupport.bearer(SliceSupport.ALICE_TOKEN))
                .header("Idempotency-Key", SliceSupport.KEY_A)
                .contentType(MediaType.APPLICATION_JSON)
                .content(body1))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.readjustmentId").isNotEmpty())
        .andExpect(jsonPath("$.baseVersion").value(1))
        .andExpect(jsonPath("$.opId").isNotEmpty())
        .andReturn();

    // Materialize new plan to get updated progress
    PlanStore.PlanRecord planV2 = PlanStore.latest(PlanStore.get(plan.id()).draftId());

    // Read plan v2 - progress should be 1/total
    mvc.perform(get("/v1/plans/" + planV2.id())
            .header("Authorization", SliceSupport.bearer(SliceSupport.ALICE_TOKEN)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.full.metrics.progress.done").value(1))
        .andExpect(jsonPath("$.full.metrics.progress.total").value(75));

    // Second completion delta
    String body2 = "{\"baseVersion\":2,\"delta\":{\"taskId\":\"DSA-L0-02\",\"confidence\":5,\"evidence\":\"run_l002.log 3 PASS\"}}";
    mvc.perform(post("/v1/plans/" + planV2.id() + "/readjustments")
            .header("Authorization", SliceSupport.bearer(SliceSupport.ALICE_TOKEN))
            .header("Idempotency-Key", SliceSupport.KEY_B)
            .contentType(MediaType.APPLICATION_JSON)
            .content(body2))
        .andExpect(status().isCreated());

    // Materialize plan v3
    PlanStore.PlanRecord planV3 = PlanStore.latest(PlanStore.get(planV2.id()).draftId());

    // Progress should be 2/total
    mvc.perform(get("/v1/plans/" + planV3.id())
            .header("Authorization", SliceSupport.bearer(SliceSupport.ALICE_TOKEN)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.full.metrics.progress.done").value(2))
        .andExpect(jsonPath("$.full.metrics.progress.total").value(75));
  }

  @Test
  void badConfidenceIs422() throws Exception {
    PlanStore.PlanRecord plan = readyPlan();
    String badConf = "{\"baseVersion\":1,\"delta\":{\"taskId\":\"DSA-L0-01\",\"confidence\":9,\"evidence\":\"x\"}}";
    mvc.perform(post("/v1/plans/" + plan.id() + "/readjustments")
            .header("Authorization", SliceSupport.bearer(SliceSupport.ALICE_TOKEN))
            .header("Idempotency-Key", SliceSupport.KEY_B)
            .contentType(MediaType.APPLICATION_JSON)
            .content(badConf))
        .andExpect(status().isUnprocessableEntity())
        .andExpect(jsonPath("$.code").value("DELTA_INVALID"));

    String badConf2 = "{\"baseVersion\":1,\"delta\":{\"taskId\":\"DSA-L0-01\",\"confidence\":0,\"evidence\":\"x\"}}";
    mvc.perform(post("/v1/plans/" + plan.id() + "/readjustments")
            .header("Authorization", SliceSupport.bearer(SliceSupport.ALICE_TOKEN))
            .header("Idempotency-Key", SliceSupport.KEY_C)
            .contentType(MediaType.APPLICATION_JSON)
            .content(badConf2))
        .andExpect(status().isUnprocessableEntity())
        .andExpect(jsonPath("$.code").value("DELTA_INVALID"));
  }

  @Test
  void stringTasksRejected400() throws Exception {
    PlanStore.PlanRecord plan = readyPlan();
    // Legacy string tasks should be rejected by PlanStore materialise
    // This test verifies the controller doesn't accept string arrays
    String stringDelta = "{\"baseVersion\":1,\"delta\":{\"missedDate\":\"2026-09-01\"}}";
    mvc.perform(post("/v1/plans/" + plan.id() + "/readjustments")
            .header("Authorization", SliceSupport.bearer(SliceSupport.ALICE_TOKEN))
            .header("Idempotency-Key", SliceSupport.KEY_A)
            .contentType(MediaType.APPLICATION_JSON)
            .content(stringDelta))
        .andExpect(status().isCreated()); // Legacy still works

    // But if someone tries to send string tasks in delta (not supported)
    String invalidDelta = "{\"baseVersion\":1,\"delta\":{\"tasks\":[\"task1\",\"task2\"]}}";
    mvc.perform(post("/v1/plans/" + plan.id() + "/readjustments")
            .header("Authorization", SliceSupport.bearer(SliceSupport.ALICE_TOKEN))
            .header("Idempotency-Key", SliceSupport.KEY_B)
            .contentType(MediaType.APPLICATION_JSON)
            .content(invalidDelta))
        .andExpect(status().isUnprocessableEntity())
        .andExpect(jsonPath("$.code").value("DELTA_INVALID"));
  }

  @Test
  void stringTasksExplicitlyRejected400() throws Exception {
    PlanStore.PlanRecord plan = readyPlan();
    String invalidDelta = "{\"baseVersion\":1,\"delta\":{\"tasks\":[\"task1\",\"task2\"]}}";
    mvc.perform(post("/v1/plans/" + plan.id() + "/readjustments")
            .header("Authorization", SliceSupport.bearer(SliceSupport.ALICE_TOKEN))
            .header("Idempotency-Key", SliceSupport.KEY_C)
            .contentType(MediaType.APPLICATION_JSON)
            .content(invalidDelta))
        .andExpect(status().isUnprocessableEntity())
        .andExpect(jsonPath("$.code").value("DELTA_INVALID"));
  }
}