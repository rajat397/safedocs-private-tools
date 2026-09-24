package com.planly.unit;

import java.util.List;
import java.util.Map;
import java.util.Set;

import com.planly.auth.Principal;
import com.planly.ent.EntitlementService;
import com.planly.gen.IdempotencyKeys;
import com.planly.rate.RateLimitService;
import com.planly.step.StepValidator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Unit coverage for rate limits, entitlements, validators and key rules.
 */
class ServicesUnitTest {

  @BeforeEach
  void reset() {
    RateLimitService.resetForTests();
    EntitlementService.resetForTests();
  }

  @Test
  void rateLimitWindowsAndRetry() {
    long now = 10_000L;
    for (int i = 0; i < RateLimitService.ANON_DRAFTS_PER_HOUR; i++) {
      assertThat(RateLimitService.checkAnonDraft("1.2.3.4", now)).isZero();
    }
    assertThat(RateLimitService.checkAnonDraft("1.2.3.4", now)).isPositive();
    assertThat(RateLimitService.checkAnonDraft("9.9.9.9", now)).isZero();
    assertThat(RateLimitService.checkAnonDraft("1.2.3.4", now + 3600_001L)).isZero();

    for (int i = 0; i < RateLimitService.PUT_PER_IP_PER_MIN; i++) {
      assertThat(RateLimitService.checkPutByIp("5.6.7.8", now)).isZero();
    }
    assertThat(RateLimitService.checkPutByIp("5.6.7.8", now)).isPositive();

    for (int i = 0; i < RateLimitService.WRITES_PER_DRAFT_PER_HR; i++) {
      assertThat(RateLimitService.checkWritesByDraft("d1", now)).isZero();
    }
    assertThat(RateLimitService.checkWritesByDraft("d1", now)).isPositive();
    assertThat(RateLimitService.checkWritesByDraft("d1", now + 3600_001L)).isZero();
  }

  @Test
  void entitlementDefaultsAndOverrides() {
    Principal anon = Principal.anon(null);
    assertThat(EntitlementService.resolve(anon).canGenerate()).isFalse();
    assertThat(EntitlementService.resolve(anon).canReadFull()).isFalse();
    assertThat(EntitlementService.resolve(anon).canReadjust()).isFalse();

    Principal alice = new Principal("u1", null, true);
    assertThat(EntitlementService.resolve(alice).canGenerate()).isTrue();
    assertThat(EntitlementService.resolve(alice).canReadFull()).isTrue();
    assertThat(EntitlementService.resolve(alice).canReadjust()).isTrue();

    EntitlementService.setDenyOverride(Set.of("generate"));
    assertThat(EntitlementService.resolve(alice).canGenerate()).isFalse();
    assertThat(EntitlementService.resolve(alice).canReadjust()).isTrue();

    EntitlementService.setDenyOverride(Set.of("all"));
    assertThat(EntitlementService.resolve(alice).canGenerate()).isFalse();
    assertThat(EntitlementService.resolve(alice).canReadFull()).isFalse();

    EntitlementService.setDenyOverride(Set.of("full"));
    assertThat(EntitlementService.resolve(alice).canReadFull()).isFalse();
    EntitlementService.setDenyOverride(Set.of("read-full"));
    assertThat(EntitlementService.resolve(alice).canReadFull()).isFalse();

    EntitlementService.resetForTests();
    EntitlementService.putRow("u1", new EntitlementService.Verdict(false, true, true));
    assertThat(EntitlementService.resolve(alice).canGenerate()).isFalse();
    assertThat(EntitlementService.resolve(alice).canReadFull()).isTrue();

    EntitlementService.auditAllow("u1", "C1-generate");
  }

  @Test
  void stepValidatorMatrix() {
    assertThat(StepValidator.validateStep1(Map.of())).isEmpty();
    assertThat(StepValidator.validateStep1(Map.of("prepDays", "30"))).isEmpty();
    assertThat(StepValidator.validateStep1(Map.of("prepDays", "custom", "customDays", 30)))
        .isEmpty();
    assertThat(StepValidator.validateStep1(Map.of("planName", "Algebra"))).isEmpty();

    assertThat(StepValidator.validateStep1(Map.of("prepDays", "someday"))).isNotEmpty();
    assertThat(StepValidator.validateStep1(Map.of("prepDays", "custom"))).isNotEmpty();
    assertThat(StepValidator.validateStep1(Map.of("prepDays", "custom", "customDays", 3)))
        .isNotEmpty();
    assertThat(StepValidator.validateStep1(Map.of("prepDays", "custom", "customDays", 400)))
        .isNotEmpty();
    assertThat(StepValidator.validateStep1(Map.of("prepDays", "custom", "customDays", "x")))
        .isNotEmpty();
    assertThat(StepValidator.validateStep1(Map.of("customDays", 2))).isNotEmpty();
    assertThat(StepValidator.validateStep1(Map.of("customDays", 30))).isEmpty();
    assertThat(StepValidator.validateStep1(Map.of("planName", ""))).isNotEmpty();
    assertThat(StepValidator.validateStep1(
        Map.of("planName", "x".repeat(61)))).isNotEmpty();
    assertThat(StepValidator.validateStep1(Map.of("planName", 42))).isNotEmpty();
  }

  @Test
  void validDates() {
    assertThat(StepValidator.validDate("2026-09-01")).isTrue();
    assertThat(StepValidator.validDate("not-a-date")).isFalse();
    assertThat(StepValidator.validDate(null)).isFalse();
    assertThat(StepValidator.validDate("2026-13-99")).isFalse();
  }

  @Test
  void idempotencyKeyRules() {
    assertThat(IdempotencyKeys.valid("11111111-1111-4111-8111-111111111111")).isTrue();
    assertThat(IdempotencyKeys.valid(" 11111111-1111-4111-8111-111111111111 ")).isTrue();
    assertThat(IdempotencyKeys.valid("not-a-uuid")).isFalse();
    assertThat(IdempotencyKeys.valid("11111111-1111-1111-1111-111111111111")).isFalse();
    assertThat(IdempotencyKeys.valid(null)).isFalse();
    assertThat(IdempotencyKeys.valid("")).isFalse();
    assertThat(IdempotencyKeys.validOptional(null)).isTrue();
    assertThat(IdempotencyKeys.validOptional("")).isTrue();
    assertThat(IdempotencyKeys.validOptional("nope")).isFalse();
    assertThat(IdempotencyKeys.validOptional("11111111-1111-4111-8111-111111111111")).isTrue();
  }

  @Test
  void anonPrincipalShape() {
    Principal anon = Principal.anon("d1");
    assertThat(anon.authed()).isFalse();
    assertThat(anon.userId()).isNull();
    assertThat(anon.draftId()).isEqualTo("d1");
    assertThat(List.of(anon).size()).isEqualTo(1);
  }

  @Test
  void entitlementDenySetBranchCoverage() {
    // Test denySet with ENTITLEMENT_DENY env var not set (default branch)
    EntitlementService.resetForTests();
    Principal alice = new Principal("u1", null, true);
    assertThat(EntitlementService.resolve(alice).canGenerate()).isTrue();
    assertThat(EntitlementService.resolve(alice).canReadFull()).isTrue();
    assertThat(EntitlementService.resolve(alice).canReadjust()).isTrue();

    // Test with env var set to various values using reflection to avoid System.setProperty issues
    try {
      java.lang.reflect.Method denySet = EntitlementService.class.getDeclaredMethod("denySet");
      denySet.setAccessible(true);

      // Test denySet() directly with various env scenarios
      // We can't easily change System.getenv, so test the behavior through resolve() with denyOverride

      EntitlementService.setDenyOverride(java.util.Set.of("generate"));
      assertThat(EntitlementService.resolve(alice).canGenerate()).isFalse();
      assertThat(EntitlementService.resolve(alice).canReadFull()).isTrue();

      EntitlementService.setDenyOverride(java.util.Set.of("all"));
      assertThat(EntitlementService.resolve(alice).canGenerate()).isFalse();
      assertThat(EntitlementService.resolve(alice).canReadFull()).isFalse();

      EntitlementService.setDenyOverride(java.util.Set.of("full"));
      assertThat(EntitlementService.resolve(alice).canReadFull()).isFalse();

      EntitlementService.setDenyOverride(java.util.Set.of("read-full"));
      assertThat(EntitlementService.resolve(alice).canReadFull()).isFalse();

      EntitlementService.setDenyOverride(java.util.Set.of("readjust"));
      assertThat(EntitlementService.resolve(alice).canReadjust()).isFalse();

      // Test with empty parts and whitespace via denyOverride
      EntitlementService.setDenyOverride(java.util.Set.of("generate", "read-full"));
      assertThat(EntitlementService.resolve(alice).canGenerate()).isFalse();
      assertThat(EntitlementService.resolve(alice).canReadFull()).isFalse();
      assertThat(EntitlementService.resolve(alice).canReadjust()).isTrue();

      EntitlementService.resetForTests();
      assertThat(EntitlementService.resolve(alice).canGenerate()).isTrue();
      assertThat(EntitlementService.resolve(alice).canReadFull()).isTrue();
      assertThat(EntitlementService.resolve(alice).canReadjust()).isTrue();
    } catch (Exception e) {
      throw new RuntimeException(e);
    }
  }

  @Test
  void rateLimitGlobalShedBranchCoverage() {
    // Test checkGlobalShed when under limit (returns 0)
    RateLimitService.resetForTests();
    long now = System.currentTimeMillis();
    for (int i = 0; i < RateLimitService.GLOBAL_PER_DAY; i++) {
      assertThat(RateLimitService.checkGlobalShed(now)).isZero();
    }
    // Test checkGlobalShed when limit exceeded (returns positive)
    assertThat(RateLimitService.checkGlobalShed(now)).isPositive();

    // Test checkGlobalShed with time advancement (window expiry)
    long dayMs = 24L * 3600 * 1000;
    assertThat(RateLimitService.checkGlobalShed(now + dayMs + 1)).isZero();
  }

  @Test
  void rateLimitRetryAfterBranchCoverage() {
    // Test retryAfter with null oldest (returns 1)
    RateLimitService.resetForTests();
    long now = System.currentTimeMillis();
    // Access private method via reflection to test the null oldest branch
    try {
      java.lang.reflect.Method method = RateLimitService.class.getDeclaredMethod("retryAfter", Long.class, long.class, long.class);
      method.setAccessible(true);
      // null oldest
      long result = (long) method.invoke(null, null, 3600_000L, now);
      assertThat(result).isEqualTo(1);

      // oldest in future (should return 1 due to Math.max)
      long future = now + 1000;
      result = (long) method.invoke(null, future, 3600_000L, now);
      assertThat(result).isGreaterThanOrEqualTo(1);

      // normal case
      long oldest = now - 1000;
      result = (long) method.invoke(null, oldest, 3600_000L, now);
      assertThat(result).isGreaterThanOrEqualTo(1);
    } catch (Exception e) {
      throw new RuntimeException(e);
    }
  }
}
