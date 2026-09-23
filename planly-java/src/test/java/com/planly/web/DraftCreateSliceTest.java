package com.planly.web;

import com.planly.auth.JwtVerifier;
import com.planly.common.WarmupState;
import com.planly.draft.DraftStore;
import com.planly.rate.RateLimitService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Matrix: POST drafts 201 + 30d cookie, 405 PATCH guard, 429 anon quota,
 * 503 cold-start, 401/403/404/410 fetch paths, bind + discard.
 */
@WebMvcTest
class DraftCreateSliceTest {

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
  void createAnonReturns201WithDraftCookie() throws Exception {
    mvc.perform(post("/v1/drafts")
            .contentType(MediaType.APPLICATION_JSON)
            .content("{}"))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.id").isNotEmpty())
        .andExpect(jsonPath("$.version").value(1))
        .andExpect(jsonPath("$.status").value("open"))
        .andExpect(header().string("Set-Cookie", containsString("draftId=")))
        .andExpect(header().string("Set-Cookie", containsString("HttpOnly")))
        .andExpect(header().string("Set-Cookie", containsString("Secure")))
        .andExpect(header().string("Set-Cookie", containsString("SameSite=Lax")))
        .andExpect(header().string("Set-Cookie", containsString("Max-Age=2592000")))
        .andExpect(header().string("Set-Cookie", containsString("Path=/")));
  }

  @Test
  void createWithAllowlistedNextOk() throws Exception {
    mvc.perform(post("/v1/drafts")
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"next\":\"/planly\"}"))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.id").isNotEmpty());
  }

  @Test
  void createWithOffAllowlistNextIs400() throws Exception {
    mvc.perform(post("/v1/drafts")
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"next\":\"https://evil.example\"}"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("BAD_NEXT"));
  }

  @Test
  void createMalformedJsonIs400() throws Exception {
    mvc.perform(post("/v1/drafts")
            .contentType(MediaType.APPLICATION_JSON)
            .content("{nope"))
        .andExpect(status().isBadRequest());
  }

  @Test
  void fetchOwnDraftIs200() throws Exception {
    DraftStore.Draft draft = SliceSupport.anonDraft();
    mvc.perform(get("/v1/drafts/" + draft.id())
            .cookie(SliceSupport.draftCookie(draft.id())))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.id").value(draft.id()));
  }

  @Test
  void fetchWithoutCredentialIs401() throws Exception {
    DraftStore.Draft draft = SliceSupport.anonDraft();
    mvc.perform(get("/v1/drafts/" + draft.id()))
        .andExpect(status().isUnauthorized())
        .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
  }

  @Test
  void fetchForeignCookieIs403() throws Exception {
    DraftStore.Draft mine = SliceSupport.anonDraft();
    DraftStore.Draft other = SliceSupport.anonDraft();
    mvc.perform(get("/v1/drafts/" + mine.id())
            .cookie(SliceSupport.draftCookie(other.id())))
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.code").value("FORBIDDEN"));
  }

  @Test
  void fetchMissingIs404() throws Exception {
    mvc.perform(get("/v1/drafts/does-not-exist")
            .cookie(SliceSupport.draftCookie("does-not-exist")))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("NOT_FOUND"));
  }

  @Test
  void fetchDiscardedIs410() throws Exception {
    DraftStore.Draft draft = SliceSupport.anonDraft();
    DraftStore.discard(draft.id(), System.currentTimeMillis());
    mvc.perform(get("/v1/drafts/" + draft.id())
            .cookie(SliceSupport.draftCookie(draft.id())))
        .andExpect(status().isGone())
        .andExpect(jsonPath("$.code").value("DISCARDED"));
  }

  @Test
  void bindRequiresAuth401() throws Exception {
    DraftStore.Draft draft = SliceSupport.anonDraft();
    mvc.perform(post("/v1/drafts/" + draft.id() + "/bind")
            .cookie(SliceSupport.draftCookie(draft.id())))
        .andExpect(status().isUnauthorized())
        .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
  }

  @Test
  void bindMergesAndSetsCookie() throws Exception {
    SliceSupport.authMock();
    DraftStore.Draft draft = SliceSupport.anonDraft();
    mvc.perform(post("/v1/drafts/" + draft.id() + "/bind")
            .header("Authorization", SliceSupport.bearer(SliceSupport.ALICE_TOKEN))
            .cookie(SliceSupport.draftCookie(draft.id())))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.merged").value(true))
        .andExpect(jsonPath("$.ownerUserId").value(SliceSupport.ALICE))
        .andExpect(header().string("Set-Cookie", containsString("draftId=")));
  }

  @Test
  void forgedTokenIs401() throws Exception {
    JwtVerifier.setTestVerifier(token -> null);
    DraftStore.Draft draft = SliceSupport.anonDraft();
    mvc.perform(get("/v1/drafts/" + draft.id())
            .header("Authorization", "Bearer forged")
            .cookie(SliceSupport.draftCookie(draft.id())))
        .andExpect(status().isUnauthorized())
        .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
  }

  @Test
  void discardClearsCookie() throws Exception {
    DraftStore.Draft draft = SliceSupport.anonDraft();
    mvc.perform(post("/v1/drafts/" + draft.id() + "/discard")
            .cookie(SliceSupport.draftCookie(draft.id())))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("discarded"))
        .andExpect(header().string("Set-Cookie", containsString("draftId=")))
        .andExpect(header().string("Set-Cookie", containsString("Max-Age=0")));
  }

  @Test
  void patchOnV1Is405WithAllow() throws Exception {
    mvc.perform(patch("/v1/drafts")
            .contentType(MediaType.APPLICATION_JSON)
            .content("{}"))
        .andExpect(status().isMethodNotAllowed())
        .andExpect(header().string("Allow", "GET, POST, PUT, DELETE"))
        .andExpect(jsonPath("$.code").value("METHOD_NOT_ALLOWED"));
  }

  @Test
  void anonQuotaExhaustedIs429WithRetryAfter() throws Exception {
    long now = System.currentTimeMillis();
    for (int i = 0; i < RateLimitService.ANON_DRAFTS_PER_HOUR; i++) {
      RateLimitService.checkAnonDraft("127.0.0.1", now);
    }
    mvc.perform(post("/v1/drafts")
            .contentType(MediaType.APPLICATION_JSON)
            .content("{}"))
        .andExpect(status().isTooManyRequests())
        .andExpect(header().exists("Retry-After"))
        .andExpect(jsonPath("$.code").value("RATE_LIMITED"));
  }

  @Test
  void coldStartIs503WithRetryAfter() throws Exception {
    WarmupState.setColdForTests(true);
    try {
      mvc.perform(post("/v1/drafts")
              .contentType(MediaType.APPLICATION_JSON)
              .content("{}"))
          .andExpect(status().isServiceUnavailable())
          .andExpect(header().string("Retry-After", "20"))
          .andExpect(jsonPath("$.code").value("COLD_START"));
    } finally {
      WarmupState.setColdForTests(false);
    }
  }

  @Test
  void errorBodyIsProblemJson() throws Exception {
    mvc.perform(get("/v1/drafts/does-not-exist"))
        .andExpect(status().isUnauthorized())
        .andExpect(content().contentTypeCompatibleWith("application/problem+json"))
        .andExpect(jsonPath("$.requestId").isNotEmpty());
  }
}
