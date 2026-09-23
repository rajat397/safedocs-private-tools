package com.planly.unit;

import java.util.Map;

import com.planly.draft.DraftStore;
import com.planly.gen.OpStore;
import com.planly.plan.PlanStore;
import com.planly.step.StepStore;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Unit coverage for the in-memory lanes (prod persists via Flyway RPCs;
 * these are the single-JVM equivalents).
 */
class StoresUnitTest {

  @BeforeEach
  void reset() {
    DraftStore.resetForTests();
    StepStore.resetForTests();
    PlanStore.resetForTests();
    OpStore.resetForTests();
  }

  @Test
  void draftOccCompareVersion() {
    DraftStore.Draft draft = DraftStore.create(null, 1000L);
    assertThat(draft.version()).isEqualTo(1);

    DraftStore.Draft bumped = DraftStore.compareVersion(draft.id(), 1, 2000L);
    assertThat(bumped.version()).isEqualTo(2);

    assertThat(DraftStore.compareVersion(draft.id(), 1, 3000L)).isNull();
    assertThat(DraftStore.compareVersion("missing", 1, 3000L)).isNull();
  }

  @Test
  void draftBumpAndMissing() {
    DraftStore.Draft draft = DraftStore.create(null, 1000L);
    assertThat(DraftStore.bump(draft.id(), 2000L).version()).isEqualTo(2);
    assertThat(DraftStore.bump("missing", 2000L)).isNull();
  }

  @Test
  void draftMarkGeneratedAndDiscard() {
    DraftStore.Draft draft = DraftStore.create(null, 1000L);
    assertThat(DraftStore.markGenerated(draft.id(), 2000L).status()).isEqualTo("generated");
    assertThat(DraftStore.discard(draft.id(), 3000L).status()).isEqualTo("discarded");
    assertThat(DraftStore.discard(draft.id(), 4000L).status()).isEqualTo("discarded");
    assertThat(DraftStore.markGenerated("missing", 1000L)).isNull();
  }

  @Test
  void draftBindFirstWins() {
    DraftStore.Draft draft = DraftStore.create(null, 1000L);
    DraftStore.BindResult first = DraftStore.bind(draft.id(), "u1", 2000L);
    assertThat(first.merged()).isTrue();
    assertThat(first.foreign()).isFalse();

    DraftStore.BindResult replay = DraftStore.bind(draft.id(), "u1", 3000L);
    assertThat(replay.merged()).isFalse();
    assertThat(replay.foreign()).isFalse();

    DraftStore.BindResult foreign = DraftStore.bind(draft.id(), "u2", 4000L);
    assertThat(foreign.foreign()).isTrue();

    assertThat(DraftStore.bind("missing", "u1", 1000L)).isNull();
    assertThat(DraftStore.link(draft.id()).userId()).isEqualTo("u1");
  }

  @Test
  void draftPurgeTtl() {
    DraftStore.Draft draft = DraftStore.create(null, 1000L);
    assertThat(DraftStore.purged(draft, 1000L + DraftStore.TTL_MS - 1)).isFalse();
    assertThat(DraftStore.purged(draft, 1000L + DraftStore.TTL_MS)).isTrue();
    assertThat(DraftStore.purged(null, 9999L)).isFalse();

    assertThat(DraftStore.purgeOlderThan(2000L)).isEqualTo(1);
    assertThat(DraftStore.get(draft.id())).isNull();
    assertThat(DraftStore.purgeOlderThan(2000L)).isZero();
  }

  @Test
  void stepPutOccAndMaxN() {
    String id = "d1";
    StepStore.StepRow row = StepStore.put(id, 1, Map.of("a", 1), 1, 1000L);
    assertThat(row.version()).isEqualTo(2);
    assertThat(StepStore.maxN(id)).isEqualTo(1);
    assertThat(StepStore.hasPayload(id, 1)).isTrue();
    assertThat(StepStore.hasPayload(id, 2)).isFalse();
    assertThat(StepStore.hasPayload("missing", 1)).isFalse();

    assertThat(StepStore.put(id, 1, Map.of("a", 2), 1, 2000L)).isNull();
    StepStore.StepRow row2 = StepStore.put(id, 1, Map.of("a", 2), 2, 2000L);
    assertThat(row2.version()).isEqualTo(3);
    assertThat(StepStore.put(id, 1, null, 3, 3000L).payload()).isEmpty();
  }

  @Test
  void planMaterialiseAndReadjustReplay() {
    String draftId = "d1";
    StepStore.put(draftId, 1, Map.of("planName", "T"), 1, 1000L);
    PlanStore.PlanRecord v1 = PlanStore.materialise(draftId, 2000L);
    assertThat(v1.version()).isEqualTo(1);
    assertThat(v1.teaser()).containsEntry("title", "T");
    assertThat(v1.full()).containsKey("metrics");
    assertThat(PlanStore.headVersion(draftId)).isEqualTo(1);
    assertThat(PlanStore.versions(draftId)).containsExactly(1);
    assertThat(PlanStore.latest(draftId).id()).isEqualTo(v1.id());
    assertThat(PlanStore.get(v1.id()).id()).isEqualTo(v1.id());

    PlanStore.PlanRecord v2 = PlanStore.appendReadjustment(v1.id(), draftId, 1,
        Map.of("missedDate", "2026-01-01"), "u1", "k1", "op1", 3000L);
    assertThat(v2.version()).isEqualTo(2);
    String rid = PlanStore.readjustmentFor(draftId, "k1");
    assertThat(rid).isNotBlank();
    assertThat(PlanStore.replay(draftId, "k1").opId()).isEqualTo("op1");
    assertThat(PlanStore.readjustmentFor(draftId, "nope")).isNull();

    PlanStore.PlanRecord replayed = PlanStore.appendReadjustment(v1.id(), draftId,
        1, Map.of("missedDate", "2026-01-02"), "u1", "k1", "op2", 4000L);
    assertThat(replayed.version()).isEqualTo(2);

    PlanStore.putReplay(draftId, "k2", new PlanStore.Replay("r2", 1, "op9"));
    assertThat(PlanStore.replay(draftId, "k2").readjustmentId()).isEqualTo("r2");
  }

  @Test
  void planTeaserDefaultsWithoutStep() {
    PlanStore.PlanRecord plan = PlanStore.materialise("ghost", 1000L);
    assertThat(plan.teaser()).containsEntry("title", "Plan");
  }

  @Test
  void opLifecycleAndExpiry() {
    OpStore.Operation op = OpStore.create("d1", "k1", 1000L, () -> {
    });
    assertThat(op.status()).isEqualTo("accepted");
    assertThat(OpStore.byKey("d1", "k1", 2000L))
        .isInstanceOf(OpStore.Live.Found.class);
    assertThat(OpStore.byId(op.opId(), 2000L))
        .isInstanceOf(OpStore.Live.Found.class);
    assertThat(OpStore.byId("missing", 2000L))
        .isInstanceOf(OpStore.Live.Missing.class);
    assertThat(OpStore.byKey("d1", "nope", 2000L))
        .isInstanceOf(OpStore.Live.Missing.class);

    OpStore.complete(op.opId(), "p1", 1, 3000L);
    OpStore.Live.Found done = (OpStore.Live.Found) OpStore.byId(op.opId(), 3000L);
    assertThat(done.op().status()).isEqualTo("succeeded");
    assertThat(done.op().planId()).isEqualTo("p1");

    OpStore.Operation op2 = OpStore.create("d1", "k2", 1000L, () -> {
    });
    OpStore.fail(op2.opId(), "E1", 2000L);
    assertThat(((OpStore.Live.Found) OpStore.byId(op2.opId(), 2000L)).op().errorCode())
        .isEqualTo("E1");

    assertThat(OpStore.byId(op.opId(), 1000L + OpStore.TTL_MS))
        .isInstanceOf(OpStore.Live.Expired.class);
    assertThat(OpStore.purgeExpired(1000L + OpStore.TTL_MS + 1)).isPositive();
    assertThat(OpStore.byId(op2.opId(), 1000L + OpStore.TTL_MS + 1))
        .isInstanceOf(OpStore.Live.Missing.class);
    OpStore.fail("missing", "E", 1000L);
    OpStore.complete("missing", "p", 1, 1000L);
  }

  @Test
  void opAcceptedTransitionsToRunning() throws Exception {
    OpStore.create("d1", "k3", System.currentTimeMillis(), () -> {
    });
    Thread.sleep(500L);
    OpStore.Live live = OpStore.byKey("d1", "k3", System.currentTimeMillis());
    assertThat(live).isInstanceOf(OpStore.Live.Found.class);
    assertThat(((OpStore.Live.Found) live).op().status()).isIn("running", "succeeded");
  }
}
