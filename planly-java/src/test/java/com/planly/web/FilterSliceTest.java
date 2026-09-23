package com.planly.web;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Filter/header matrix: request-id echo + regeneration, CORS preflight,
 * canonical-host redirect, OPTIONS handling.
 */
@WebMvcTest
class FilterSliceTest {

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
  void validRequestIdIsEchoed() throws Exception {
    mvc.perform(get("/health").header("X-Request-Id", "abc-123-XYZ"))
        .andExpect(status().isOk())
        .andExpect(header().string("X-Request-Id", "abc-123-XYZ"));
  }

  @Test
  void invalidRequestIdIsRegenerated() throws Exception {
    String echoed = mvc.perform(get("/health").header("X-Request-Id", "<script>"))
        .andExpect(status().isOk())
        .andReturn().getResponse().getHeader("X-Request-Id");
    org.assertj.core.api.Assertions.assertThat(echoed)
        .isNotEqualTo("<script>")
        .matches("^[A-Za-z0-9-]{1,64}$");
  }

  @Test
  void missingRequestIdIsAssigned() throws Exception {
    mvc.perform(get("/health"))
        .andExpect(status().isOk())
        .andExpect(header().exists("X-Request-Id"))
        .andExpect(jsonPath("$.status").value("ok"));
  }

  @Test
  void corsPreflightIs204() throws Exception {
    mvc.perform(options("/v1/drafts")
            .header("Origin", "https://app.planly.test")
            .header("Access-Control-Request-Method", "POST"))
        .andExpect(status().isNoContent())
        .andExpect(header().string("Access-Control-Allow-Origin", "https://app.planly.test"))
        .andExpect(header().string("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE"));
  }

  @Test
  void disallowedOriginGetsNoEcho() throws Exception {
    mvc.perform(get("/health").header("Origin", "https://evil.example"))
        .andExpect(status().isOk())
        .andExpect(header().doesNotExist("Access-Control-Allow-Origin"));
  }

  @Test
  void allowedOriginIsEchoedOnGet() throws Exception {
    mvc.perform(get("/health").header("Origin", "https://app.planly.test"))
        .andExpect(status().isOk())
        .andExpect(header().string("Access-Control-Allow-Origin", "https://app.planly.test"));
  }

  @Test
  void appHostRedirectsToApiTwin() throws Exception {
    mvc.perform(get("/health").header("Host", "app.planly.test"))
        .andExpect(status().isMovedPermanently())
        .andExpect(header().string("Location",
            org.hamcrest.Matchers.containsString("api.planly.test")));
  }

  @Test
  void v1WritesHaveProblemContentType() throws Exception {
    mvc.perform(get("/v1/drafts/nope")
            .contentType(MediaType.APPLICATION_JSON))
        .andExpect(status().isUnauthorized())
        .andExpect(header().string("Content-Type",
            org.hamcrest.Matchers.containsString("application/problem+json")));
  }
}
