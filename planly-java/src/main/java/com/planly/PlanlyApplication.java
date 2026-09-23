package com.planly;

import com.planly.auth.JwtVerifier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class PlanlyApplication {

  private static final Logger log = LoggerFactory.getLogger(PlanlyApplication.class);

  public static void main(String[] args) {
    guardAuthConfig();
    SpringApplication.run(PlanlyApplication.class, args);
  }

  /**
   * Boot guard: refuse prod-like boot without JWKS_URL and SUPABASE_URL.
   * The test-only lenient lane (APP_PROFILE=local|test + AUTH_LENIENT=true)
   * boots with a warning instead.
   */
  static void guardAuthConfig() {
    if (JwtVerifier.lenientAllowed()) {
      log.warn("booting with auth lenient mode; never enable in prod");
      return;
    }
    String jwksUrl = System.getenv("JWKS_URL");
    String supabaseUrl = System.getenv("SUPABASE_URL");
    if (jwksUrl == null || jwksUrl.isBlank()
        || supabaseUrl == null || supabaseUrl.isBlank()) {
      throw new IllegalStateException(
          "refusing prod boot without JWKS_URL and SUPABASE_URL; "
              + "set both, or use APP_PROFILE=local|test with AUTH_LENIENT=true for dev");
    }
  }
}
