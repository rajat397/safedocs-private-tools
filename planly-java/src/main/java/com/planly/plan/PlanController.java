package com.planly.plan;

import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.UUID;

import com.planly.auth.Auths;
import com.planly.auth.Principal;
import com.planly.common.Errors;
import com.planly.draft.DraftController;
import com.planly.draft.DraftStore;
import com.planly.ent.EntitlementService;
import com.planly.gen.IdempotencyKeys;
import com.planly.gen.OpStore;
import com.planly.plan.PlanDtos.PlanResponse;
import com.planly.plan.PlanDtos.ReadjustAccepted;
import com.planly.rate.RateLimitService;
import com.planly.step.StepValidator;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.json.BasicJsonParser;
import org.springframework.boot.json.JsonParser;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import jakarta.servlet.http.HttpServletRequest;

/**
 * Plan reads (teaser-or-full + ETag, choke C2) and readjust appends
 * (baseVersion required, choke C3). Plans are immutable; readjustments are
 * append-only; both are written only via {@link PlanStore}.
 */
@RestController
@RequestMapping("/v1/plans")
public class PlanController {

  private static final Logger log = LoggerFactory.getLogger(PlanController.class);
  public static final int DELTA_CAP_BYTES = 64 * 1024;
  private static final JsonParser JSON = new BasicJsonParser();

  @GetMapping("/{id}")
  public ResponseEntity<PlanResponse> read(@PathVariable("id") String id,
      HttpServletRequest request) {
    shed();
    PlanStore.PlanRecord plan = PlanStore.get(id);
    if (plan == null) {
      throw Errors.fail(HttpStatus.NOT_FOUND, "NOT_FOUND");
    }
    DraftStore.Draft draft = DraftStore.get(plan.draftId());
    if (draft == null || DraftStore.purged(draft, System.currentTimeMillis())) {
      throw Errors.fail(HttpStatus.NOT_FOUND, "NOT_FOUND");
    }
    if ("discarded".equals(draft.status())) {
      throw Errors.fail(HttpStatus.GONE, "DISCARDED");
    }
    Principal principal;
    try {
      principal = Auths.resolve(request);
    } catch (Exception e) {
      principal = Principal.anon(null);
    }
    // Check if authenticated but not owner/holder -> 403
    Auths.Access denied = Auths.checkDraftAccess(principal,
        draft.ownerUserId(), draft.id());
    if (denied == Auths.Access.FORBIDDEN) {
      throw Errors.fail(HttpStatus.FORBIDDEN, "FORBIDDEN");
    }
    // Allow teaser for unauthenticated (public) and holders; full only for entitled owners
    boolean entitled = principal.authed() && EntitlementService.resolve(principal).canReadFull();
    if (entitled) {
      EntitlementService.auditAllow(principal.userId(), "C2-read-full");
    }
    PlanView view = TeaserGuard.filter(plan, entitled);
    String etag = etag(plan.id(), plan.version());
    String inm = normalize(request.getHeader("If-None-Match"));
    if (inm != null && inm.equals("plan-" + plan.id() + "-v" + plan.version())) {
      return ResponseEntity.status(HttpStatus.NOT_MODIFIED)
          .header("ETag", etag).build();
    }
    Map<String, Object> full = view instanceof PlanView.Full fullView
        ? fullView.full() : null;
    String cache = full != null ? "private, no-store" : "public, s-maxage=60";
    return ResponseEntity.ok().header("ETag", etag)
        .header("Cache-Control", cache)
        .body(new PlanResponse(view.id(), view.version(), view.teaser(), full));
  }

  @PostMapping({"/{id}/readjustments", "/{id}/readjust"})
  public ResponseEntity<ReadjustAccepted> readjust(@PathVariable("id") String id,
      HttpServletRequest request, @RequestBody(required = false) byte[] raw) {
    long now = System.currentTimeMillis();
    shed();
    String key = request.getHeader("Idempotency-Key");
    if (key == null || key.isBlank() || !IdempotencyKeys.valid(key)) {
      throw Errors.fail(HttpStatus.BAD_REQUEST, "BAD_IDEMPOTENCY_KEY");
    }
    PlanStore.PlanRecord plan = PlanStore.get(id);
    if (plan == null) {
      throw Errors.fail(HttpStatus.NOT_FOUND, "NOT_FOUND");
    }
    DraftStore.Draft draft = DraftStore.get(plan.draftId());
    if (draft == null || DraftStore.purged(draft, now)) {
      throw Errors.fail(HttpStatus.NOT_FOUND, "NOT_FOUND");
    }
    if ("discarded".equals(draft.status())) {
      throw Errors.fail(HttpStatus.GONE, "DISCARDED");
    }
    Principal principal = principal(request);
    denyUnlessHolder(draft, principal);
    throttle(request, draft.id(), now);
    if (!EntitlementService.resolve(principal).canReadjust()) {
      throw Errors.fail(HttpStatus.PAYMENT_REQUIRED, "ENTITLEMENT_REQUIRED");
    }
    String trimmedKey = key.trim();
    PlanStore.Replay replay = PlanStore.replay(draft.id(), trimmedKey);
    if (replay != null) {
      OpStore.Live linked = OpStore.byKey(draft.id(), trimmedKey, now);
      if (linked instanceof OpStore.Live.Expired) {
        throw Errors.fail(HttpStatus.GONE, "OP_GONE");
      }
      return ResponseEntity.ok(new ReadjustAccepted(replay.readjustmentId(),
          replay.baseVersion(), replay.opId()));
    }
    if (raw != null && raw.length > DELTA_CAP_BYTES) {
      throw Errors.fail(HttpStatus.PAYLOAD_TOO_LARGE, "READJUST_TOO_LARGE");
    }
    Map<String, Object> body = parseBody(raw);
    Object baseVersion = body.get("baseVersion");
    if (!(baseVersion instanceof Number num) || num.intValue() < 1) {
      throw Errors.fail(HttpStatus.BAD_REQUEST, "MISSING_BASE_VERSION");
    }
    Object deltaRaw = body.get("delta");
    if (!(deltaRaw instanceof Map)) {
      throw Errors.fail(HttpStatus.UNPROCESSABLE_ENTITY, "DELTA_INVALID");
    }
    @SuppressWarnings("unchecked")
    Map<String, Object> delta = (Map<String, Object>) deltaRaw;
    Object missed = delta.get("missedDate");
    Object taskId = delta.get("taskId");
    Object confidence = delta.get("confidence");
    Object evidence = delta.get("evidence");

    // Validate completion delta if present
    if (taskId != null || confidence != null || evidence != null) {
      if (!(taskId instanceof String) || ((String) taskId).isBlank()) {
        throw Errors.fail(HttpStatus.UNPROCESSABLE_ENTITY, "DELTA_INVALID");
      }
      if (!(confidence instanceof Number confNum) || confNum.intValue() < 1 || confNum.intValue() > 5) {
        throw Errors.fail(HttpStatus.UNPROCESSABLE_ENTITY, "DELTA_INVALID");
      }
      if (evidence != null && !(evidence instanceof String)) {
        throw Errors.fail(HttpStatus.UNPROCESSABLE_ENTITY, "DELTA_INVALID");
      }
    } else {
      // Legacy missedDate-only delta
      if (!(missed instanceof String) || !StepValidator.validDate((String) missed)) {
        throw Errors.fail(HttpStatus.UNPROCESSABLE_ENTITY, "DELTA_INVALID");
      }
    }
    int base = ((Number) baseVersion).intValue();
    if (!PlanStore.versions(draft.id()).contains(base)) {
      throw Errors.fail(HttpStatus.CONFLICT, "STALE_BASE",
          Map.of("currentVersion", PlanStore.headVersion(draft.id())));
    }
    String opId = UUID.randomUUID().toString();
    PlanStore.PlanRecord next = PlanStore.appendReadjustment(id, draft.id(),
        base, delta, principal.userId(), trimmedKey, opId, now);
    String readjustmentId = PlanStore.readjustmentFor(draft.id(), trimmedKey);
    EntitlementService.auditAllow(principal.userId(), "C3-readjust");
    log.info("readjust planId={} base={} version={}", id, base, next.version());
    return ResponseEntity.status(HttpStatus.CREATED)
        .body(new ReadjustAccepted(readjustmentId, base, opId));
  }

  static String etag(String id, int version) {
    return "\"plan-" + id + "-v" + version + "\"";
  }

  static String normalize(String header) {
    if (header == null) {
      return null;
    }
    String norm = header.trim();
    if (norm.startsWith("W/")) {
      norm = norm.substring(2);
    }
    norm = norm.replace("\"", "");
    return norm.isEmpty() ? null : norm;
  }

  private void denyUnlessHolder(DraftStore.Draft draft, Principal principal) {
    Auths.Access denied = Auths.checkDraftAccess(principal,
        draft.ownerUserId(), draft.id());
    if (denied == null) {
      return;
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
