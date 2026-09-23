package com.planly.web;

import java.util.Set;

import com.jayway.jsonpath.JsonPath;
import com.planly.draft.DraftStore;
import com.planly.plan.PlanStore;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Matrix: teaser view has full:null + only allowlisted keys; entitled owner
 * gets full; ETag/304 on plan reads; 404/410/401/403 guards.
 */
@WebMvcTest
class PlanTeaserSliceTest {

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

  @Test
  void teaserHasFullNullAndNoLeak() throws Exception {
    DraftStore.Draft draft = SliceSupport.anonDraft();
    SliceSupport.step1Payload(draft.id(), null);
    PlanStore.PlanRecord plan = SliceSupport.materialise(draft.id());

    MvcResult result = mvc.perform(get("/v1/plans/" + plan.id())
            .cookie(SliceSupport.draftCookie(draft.id())))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.id").value(plan.id()))
        .andExpect(jsonPath("$.full", nullValue()))
        .andExpect(jsonPath("$.teaser.title").isNotEmpty())
        .andExpect(jsonPath("$.teaser.metrics").doesNotExist())
        .andExpect(header().exists("ETag"))
        .andReturn();

    @SuppressWarnings("unchecked")
    java.util.Map<String, Object> teaser = JsonPath.read(
        result.getResponse().getContentAsString(), "$.teaser");
    assertThat(teaser.keySet())
        .isSubsetOf(Set.of("title", "summary", "stepCount", "priceRange"));
  }

  @Test
  void entitledOwnerGetsFull() throws Exception {
    DraftStore.Draft draft = SliceSupport.aliceDraft();
    SliceSupport.step1Payload(draft.id(), null);
    PlanStore.PlanRecord plan = SliceSupport.materialise(draft.id());

    mvc.perform(get("/v1/plans/" + plan.id())
            .header("Authorization", SliceSupport.bearer(SliceSupport.ALICE_TOKEN)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.full").isMap())
        .andExpect(jsonPath("$.full.metrics").isMap())
        .andExpect(jsonPath("$.full.tracks").isArray())
        .andExpect(jsonPath("$.full.metrics.progress").isMap())
        .andExpect(jsonPath("$.full.metrics.progress.done").value(0))
        .andExpect(jsonPath("$.full.metrics.progress.total").value(75))
        .andExpect(header().string("Cache-Control", "private, no-store"));
  }

  @Test
  void teaserHasPublicCacheAndEtag304() throws Exception {
    DraftStore.Draft draft = SliceSupport.anonDraft();
    SliceSupport.step1Payload(draft.id(), null);
    PlanStore.PlanRecord plan = SliceSupport.materialise(draft.id());

    MvcResult first = mvc.perform(get("/v1/plans/" + plan.id())
            .cookie(SliceSupport.draftCookie(draft.id())))
        .andExpect(status().isOk())
        .andExpect(header().string("Cache-Control", "public, s-maxage=60"))
        .andReturn();
    String etag = first.getResponse().getHeader("ETag");
    assertThat(etag).isEqualTo("\"plan-" + plan.id() + "-v" + plan.version() + "\"");

    mvc.perform(get("/v1/plans/" + plan.id())
            .cookie(SliceSupport.draftCookie(draft.id()))
            .header("If-None-Match", etag))
        .andExpect(status().isNotModified());

    mvc.perform(get("/v1/plans/" + plan.id())
            .cookie(SliceSupport.draftCookie(draft.id()))
            .header("If-None-Match", "W/" + etag))
        .andExpect(status().isNotModified());
  }

  @Test
  void planGuardsMatrix() throws Exception {
    mvc.perform(get("/v1/plans/does-not-exist")
            .header("Authorization", SliceSupport.bearer(SliceSupport.ALICE_TOKEN)))
        .andExpect(status().isNotFound());

    DraftStore.Draft draft = SliceSupport.anonDraft();
    SliceSupport.step1Payload(draft.id(), null);
    PlanStore.PlanRecord plan = SliceSupport.materialise(draft.id());

    mvc.perform(get("/v1/plans/" + plan.id()))
        .andExpect(status().isUnauthorized());

    mvc.perform(get("/v1/plans/" + plan.id())
            .header("Authorization", SliceSupport.bearer(SliceSupport.BOB_TOKEN)))
        .andExpect(status().isForbidden());

    DraftStore.discard(draft.id(), System.currentTimeMillis());
    mvc.perform(get("/v1/plans/" + plan.id())
            .cookie(SliceSupport.draftCookie(draft.id())))
        .andExpect(status().isGone());
  }

  @Test
  void teaserFrozenNoTracksLeak() throws Exception {
    DraftStore.Draft draft = SliceSupport.anonDraft();
    SliceSupport.step1Payload(draft.id(), null);
    PlanStore.PlanRecord plan = SliceSupport.materialise(draft.id());

    MvcResult result = mvc.perform(get("/v1/plans/" + plan.id())
            .cookie(SliceSupport.draftCookie(draft.id())))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.full", nullValue()))
        .andExpect(jsonPath("$.teaser.tracks").doesNotExist())
        .andExpect(jsonPath("$.teaser.progress").doesNotExist())
        .andReturn();

    @SuppressWarnings("unchecked")
    java.util.Map<String, Object> teaser = JsonPath.read(
        result.getResponse().getContentAsString(), "$.teaser");
    assertThat(teaser.keySet())
        .isSubsetOf(Set.of("title", "summary", "stepCount", "priceRange"));
  }
}
