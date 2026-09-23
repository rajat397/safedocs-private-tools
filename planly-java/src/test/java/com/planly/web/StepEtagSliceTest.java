package com.planly.web;

import com.planly.draft.DraftStore;
import com.planly.rate.RateLimitService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Matrix: step PUT/GET ETag + 304, OCC 409, skip-ahead 409, 451 probe gate,
 * 413 caps (controller + container filter), 422 schema, 429 PUT quota,
 * 400 bad step numbers.
 */
@WebMvcTest
class StepEtagSliceTest {

  @Autowired
  private MockMvc mvc;

  @BeforeEach
  void setUp() {
    SliceSupport.resetAll();
  }

  @AfterEach
  void tearDown() {
    SliceSupport.resetAll();
  }

  @Test
  void putThenGetSupportsEtag304() throws Exception {
    DraftStore.Draft draft = SliceSupport.anonDraft();
    String id = draft.id();

    mvc.perform(put("/v1/drafts/" + id + "/steps/1")
            .cookie(SliceSupport.draftCookie(id))
            .header("If-Match", "1")
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"planName\":\"Algebra\"}"))
        .andExpect(status().isOk())
        .andExpect(header().string("ETag", "\"v2\""))
        .andExpect(jsonPath("$.n").value(1))
        .andExpect(jsonPath("$.version").value(2));

    mvc.perform(get("/v1/drafts/" + id + "/steps/1")
            .cookie(SliceSupport.draftCookie(id)))
        .andExpect(status().isOk())
        .andExpect(header().string("ETag", "\"v2\""))
        .andExpect(jsonPath("$.payload.planName").value("Algebra"));

    mvc.perform(get("/v1/drafts/" + id + "/steps/1")
            .cookie(SliceSupport.draftCookie(id))
            .header("If-None-Match", "\"v2\""))
        .andExpect(status().isNotModified());
  }

  @Test
  void putStaleVersionIs409() throws Exception {
    DraftStore.Draft draft = SliceSupport.anonDraft();
    String id = draft.id();

    mvc.perform(put("/v1/drafts/" + id + "/steps/1")
            .cookie(SliceSupport.draftCookie(id))
            .header("If-Match", "1")
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"planName\":\"Algebra\"}"))
        .andExpect(status().isOk());

    mvc.perform(put("/v1/drafts/" + id + "/steps/1")
            .cookie(SliceSupport.draftCookie(id))
            .header("If-Match", "1")
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"planName\":\"Geometry\"}"))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("VERSION_CONFLICT"))
        .andExpect(jsonPath("$.currentVersion").value(2));
  }

  @Test
  void putWithoutIfMatchIs409() throws Exception {
    DraftStore.Draft draft = SliceSupport.anonDraft();
    mvc.perform(put("/v1/drafts/" + draft.id() + "/steps/1")
            .cookie(SliceSupport.draftCookie(draft.id()))
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"planName\":\"Algebra\"}"))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("VERSION_CONFLICT"));
  }

  @Test
  void putSkipAheadIs409() throws Exception {
    DraftStore.Draft draft = SliceSupport.anonDraft();
    mvc.perform(put("/v1/drafts/" + draft.id() + "/steps/3")
            .cookie(SliceSupport.draftCookie(draft.id()))
            .header("If-Match", "1")
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"planName\":\"Algebra\"}"))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("STEP_AHEAD"));
  }

  @Test
  void step2IsGated451() throws Exception {
    DraftStore.Draft draft = SliceSupport.anonDraft();
    mvc.perform(get("/v1/drafts/" + draft.id() + "/steps/2")
            .cookie(SliceSupport.draftCookie(draft.id())))
        .andExpect(status().isUnavailableForLegalReasons())
        .andExpect(jsonPath("$.code").value("STEP_UNPROBED"));

    mvc.perform(put("/v1/drafts/" + draft.id() + "/steps/2")
            .cookie(SliceSupport.draftCookie(draft.id()))
            .header("If-Match", "1")
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"planName\":\"Algebra\"}"))
        .andExpect(status().isUnavailableForLegalReasons())
        .andExpect(jsonPath("$.code").value("STEP_UNPROBED"));
  }

  @Test
  void putOversizePayloadIs413() throws Exception {
    DraftStore.Draft draft = SliceSupport.anonDraft();
    String big = "x".repeat(33 * 1024);
    mvc.perform(put("/v1/drafts/" + draft.id() + "/steps/1")
            .cookie(SliceSupport.draftCookie(draft.id()))
            .header("If-Match", "1")
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"planName\":\"" + big + "\"}"))
        .andExpect(status().isPayloadTooLarge())
        .andExpect(jsonPath("$.code").value("PAYLOAD_TOO_LARGE"));
  }

  @Test
  void containerBodyCapIs413() throws Exception {
    DraftStore.Draft draft = SliceSupport.anonDraft();
    String big = "x".repeat(70 * 1024);
    mvc.perform(put("/v1/drafts/" + draft.id() + "/steps/1")
            .cookie(SliceSupport.draftCookie(draft.id()))
            .header("If-Match", "1")
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"planName\":\"" + big + "\"}"))
        .andExpect(status().isPayloadTooLarge())
        .andExpect(jsonPath("$.code").value("PAYLOAD_TOO_LARGE"));
  }

  @Test
  void putInvalidSchemaIs422() throws Exception {
    DraftStore.Draft draft = SliceSupport.anonDraft();
    mvc.perform(put("/v1/drafts/" + draft.id() + "/steps/1")
            .cookie(SliceSupport.draftCookie(draft.id()))
            .header("If-Match", "1")
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"prepDays\":\"someday\"}"))
        .andExpect(status().isUnprocessableEntity())
        .andExpect(jsonPath("$.code").value("SCHEMA_INVALID"));
  }

  @Test
  void putWithoutCredentialIs401() throws Exception {
    DraftStore.Draft draft = SliceSupport.anonDraft();
    mvc.perform(put("/v1/drafts/" + draft.id() + "/steps/1")
            .header("If-Match", "1")
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"planName\":\"Algebra\"}"))
        .andExpect(status().isUnauthorized());
  }

  @Test
  void badStepNumbersAre400() throws Exception {
    DraftStore.Draft draft = SliceSupport.anonDraft();
    mvc.perform(get("/v1/drafts/" + draft.id() + "/steps/7")
            .cookie(SliceSupport.draftCookie(draft.id())))
        .andExpect(status().isBadRequest());
    mvc.perform(get("/v1/drafts/" + draft.id() + "/steps/nope")
            .cookie(SliceSupport.draftCookie(draft.id())))
        .andExpect(status().isBadRequest());
  }

  @Test
  void putQuotaExhaustedIs429() throws Exception {
    long now = System.currentTimeMillis();
    for (int i = 0; i < RateLimitService.PUT_PER_IP_PER_MIN; i++) {
      RateLimitService.checkPutByIp("127.0.0.1", now);
    }
    DraftStore.Draft draft = SliceSupport.anonDraft();
    mvc.perform(put("/v1/drafts/" + draft.id() + "/steps/1")
            .cookie(SliceSupport.draftCookie(draft.id()))
            .header("If-Match", "1")
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"planName\":\"Algebra\"}"))
        .andExpect(status().isTooManyRequests())
        .andExpect(header().exists("Retry-After"))
        .andExpect(jsonPath("$.code").value("RATE_LIMITED"));
  }
}
