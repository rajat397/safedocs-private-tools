package com.planly.gen;

import com.planly.auth.Auths;
import com.planly.auth.Principal;
import com.planly.common.Errors;
import com.planly.draft.DraftController;
import com.planly.draft.DraftStore;
import com.planly.gen.GenDtos.OperationResponse;
import com.planly.plan.PlanStore;
import com.planly.rate.RateLimitService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import jakarta.servlet.http.HttpServletRequest;

/**
 * Operation polling: 200 across accepted/running/succeeded/failed, 404 for
 * unknown ops, 410 OP_GONE past the 24h TTL. Unknown ids are 404; callers
 * without any credential are 401; foreign holders are 403 (IDOR split).
 */
@RestController
@RequestMapping("/v1/operations")
public class OperationController {

  @GetMapping("/{opId}")
  public ResponseEntity<OperationResponse> poll(@PathVariable("opId") String opId,
      HttpServletRequest request) {
    shed();
    long now = System.currentTimeMillis();
    OpStore.Live live = OpStore.byId(opId, now);
    if (live instanceof OpStore.Live.Expired) {
      throw Errors.fail(HttpStatus.GONE, "OP_GONE");
    }
    if (!(live instanceof OpStore.Live.Found found)) {
      throw Errors.fail(HttpStatus.NOT_FOUND, "NOT_FOUND");
    }
    OpStore.Operation op = found.op();
    DraftStore.Draft draft = DraftStore.get(op.draftId());
    if (draft == null || DraftStore.purged(draft, now)) {
      throw Errors.fail(HttpStatus.NOT_FOUND, "NOT_FOUND");
    }
    if ("discarded".equals(draft.status())) {
      throw Errors.fail(HttpStatus.GONE, "DISCARDED");
    }
    Principal principal = principal(request);
    Auths.Access denied = Auths.checkDraftAccess(principal,
        draft.ownerUserId(), draft.id());
    if (denied != null) {
      if (denied == Auths.Access.UNAUTHENTICATED) {
        throw Errors.fail(HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED");
      }
      throw Errors.fail(HttpStatus.FORBIDDEN, "FORBIDDEN");
    }
    String planId = op.planId();
    Integer planVersion = op.planVersion();
    if (planId == null) {
      PlanStore.PlanRecord latest = PlanStore.latest(op.draftId());
      if (latest != null) {
        planId = latest.id();
        planVersion = latest.version();
      }
    }
    return ResponseEntity.ok(new OperationResponse(op.opId(), op.status(),
        op.draftId(), planId, planVersion, op.errorCode()));
  }

  private Principal principal(HttpServletRequest request) {
    try {
      return Auths.resolve(request);
    } catch (Exception e) {
      throw Errors.fail(HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED");
    }
  }

  private void shed() {
    long retry = RateLimitService.checkGlobalShed(System.currentTimeMillis());
    if (retry > 0) {
      throw DraftController.rateLimited(retry);
    }
  }
}
