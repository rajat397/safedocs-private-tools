package com.planly.gen;

import java.nio.charset.StandardCharsets;
import java.util.Map;

import com.planly.auth.Auths;
import com.planly.auth.Principal;
import com.planly.common.Errors;
import com.planly.draft.DraftController;
import com.planly.draft.DraftStore;
import com.planly.ent.EntitlementService;
import com.planly.gen.GenDtos.GenerateAccepted;
import com.planly.plan.PlanStore;
import com.planly.rate.RateLimitService;
import com.planly.step.StepStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.json.BasicJsonParser;
import org.springframework.boot.json.JsonParser;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import jakarta.servlet.http.HttpServletRequest;

/**
 * Async idempotent generate (choke C1). New keys get 202 accepted; replays of
 * a live key get 200 with the original opId; expired keys get 410 OP_GONE.
 * Stale snapshots get 409 STEP_STALE; incomplete drafts get 422.
 */
@RestController
@RequestMapping("/v1/drafts/{id}")
public class GenerateController {

  private static final Logger log = LoggerFactory.getLogger(GenerateController.class);
  private static final JsonParser JSON = new BasicJsonParser();

  @PostMapping("/generate")
  public ResponseEntity<GenerateAccepted> generate(@PathVariable("id") String id,
      HttpServletRequest request, @RequestBody(required = false) byte[] raw) {
    long now = System.currentTimeMillis();
    shed();
    String key = request.getHeader("Idempotency-Key");
    if (key == null || key.isBlank() || !IdempotencyKeys.valid(key)) {
      throw Errors.fail(HttpStatus.BAD_REQUEST, "BAD_IDEMPOTENCY_KEY");
    }
    DraftStore.Draft draft = visibleDraft(id, request);
    throttle(request, id, now);
    Principal principal = principal(request);
    if (!EntitlementService.resolve(principal).canGenerate()) {
      throw Errors.fail(HttpStatus.PAYMENT_REQUIRED, "ENTITLEMENT_REQUIRED");
    }
    OpStore.Live replay = OpStore.byKey(id, key.trim(), now);
    if (replay instanceof OpStore.Live.Expired) {
      throw Errors.fail(HttpStatus.GONE, "OP_GONE");
    }
    if (replay instanceof OpStore.Live.Found found) {
      return ResponseEntity.ok(new GenerateAccepted(found.op().opId(), "accepted"));
    }
    Map<String, Object> body = parseBody(raw);
    Object snapshot = body.get("stepSnapshotVersion");
    if (snapshot == null) {
      snapshot = body.get("snapshotVersion");
    }
    if (snapshot == null) {
      snapshot = body.get("version");
    }
    if (snapshot instanceof Number num && num.intValue() != draft.version()) {
      throw Errors.fail(HttpStatus.CONFLICT, "STEP_STALE",
          Map.of("currentVersion", draft.version()));
    }
    if (!StepStore.hasPayload(id, 1)) {
      throw Errors.fail(HttpStatus.UNPROCESSABLE_ENTITY, "STEP_INCOMPLETE");
    }
    String trimmedKey = key.trim();
    OpStore.Operation op = OpStore.create(id, trimmedKey, now,
        () -> finish(id, trimmedKey));
    DraftStore.markGenerated(id, System.currentTimeMillis());
    EntitlementService.auditAllow(principal.userId(), "C1-generate");
    log.info("generate accepted id={} opId={}", id, op.opId());
    return ResponseEntity.status(HttpStatus.ACCEPTED)
        .body(new GenerateAccepted(op.opId(), "accepted"));
  }

  private void finish(String draftId, String key) {
    OpStore.Live live = OpStore.byKey(draftId, key, System.currentTimeMillis());
    if (!(live instanceof OpStore.Live.Found found)) {
      return;
    }
    if (!"accepted".equals(found.op().status())
        && !"running".equals(found.op().status())) {
      return;
    }
    PlanStore.PlanRecord plan = PlanStore.materialise(draftId,
        System.currentTimeMillis());
    OpStore.complete(found.op().opId(), plan.id(), plan.version(),
        System.currentTimeMillis());
    log.info("generate succeeded draftId={} planId={}", draftId, plan.id());
  }

  private DraftStore.Draft visibleDraft(String id, HttpServletRequest request) {
    DraftStore.Draft draft = DraftStore.get(id);
    if (draft == null || DraftStore.purged(draft, System.currentTimeMillis())) {
      throw Errors.fail(HttpStatus.NOT_FOUND, "NOT_FOUND");
    }
    if ("discarded".equals(draft.status())) {
      throw Errors.fail(HttpStatus.GONE, "DISCARDED");
    }
    Principal principal = principal(request);
    Auths.Access denied = Auths.checkDraftAccess(principal,
        draft.ownerUserId(), draft.id());
    if (denied == null) {
      return draft;
    }
    if (denied == Auths.Access.UNAUTHENTICATED) {
      throw Errors.fail(HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED");
    }
    throw Errors.fail(HttpStatus.FORBIDDEN, "FORBIDDEN");
  }

  private Principal principal(HttpServletRequest request) {
    try {
      return Auths.resolve(request);
    } catch (Exception e) {
      throw Errors.fail(HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED");
    }
  }

  private Map<String, Object> parseBody(byte[] raw) {
    if (raw == null || raw.length == 0) {
      return Map.of();
    }
    try {
      Map<String, Object> parsed = JSON.parseMap(
          new String(raw, StandardCharsets.UTF_8));
      return parsed == null ? Map.of() : parsed;
    } catch (Exception e) {
      throw Errors.fail(HttpStatus.BAD_REQUEST, "BAD_REQUEST");
    }
  }

  private void shed() {
    long retry = RateLimitService.checkGlobalShed(System.currentTimeMillis());
    if (retry > 0) {
      throw DraftController.rateLimited(retry);
    }
  }

  private void throttle(HttpServletRequest request, String draftId, long now) {
    long retry = RateLimitService.checkPutByIp(Auths.clientIp(request), now);
    if (retry > 0) {
      throw DraftController.rateLimited(retry);
    }
    long perDraft = RateLimitService.checkWritesByDraft(draftId, now);
    if (perDraft > 0) {
      throw DraftController.rateLimited(perDraft);
    }
  }
}
