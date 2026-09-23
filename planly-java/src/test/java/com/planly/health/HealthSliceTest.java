package com.planly.health;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * RED: no {@code GET /health} controller exists yet, so this fails with 404.
 * GREEN will require a WebMvc controller returning {@code {"status":"ok"}}.
 */
@WebMvcTest
class HealthSliceTest {

  @Autowired
  private MockMvc mvc;

  @Test
  void healthReturnsOkStatus() throws Exception {
    mvc.perform(get("/health").accept(MediaType.APPLICATION_JSON))
        .andExpect(status().isOk())
        .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
        .andExpect(jsonPath("$.status").value("ok"));
  }
}
