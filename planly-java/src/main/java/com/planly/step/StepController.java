package com.planly.step;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

import com.planly.auth.Auths;
import com.planly.auth.Principal;
import com.planly.common.Errors;
import com.planly.draft.DraftController;
import com.planly.draft.DraftStore;
import com.planly.rate.RateLimitService;
import com.planly.step.StepDtos.PutResponse;
import com.planly.step.StepDtos.StepResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.json.BasicJsonParser;
import org.springframework.boot.json.JsonParser;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import jakarta.servlet.http.HttpServletRequest;

/**
 * Step GET/PUT with ETag OCC. Step 1 is active; Steps 2-6 are
 * probe-gated (GET/PUT 451 STEP_UNPROBED per openapi.yaml). Payloads over
 * 32KB get 413 (raw bytes are capped before parsing). Skip-ahead
 * (n &gt; maxN+1) gets 409 STEP_AHEAD.
 */
@RestController
@RequestMapping("/v1/drafts/{id}/steps")
public class StepController {

  private static final Logger log = LoggerFactory.getLogger(StepController.class);
  public static final int BODY_CAP_BYTES = 32 * 1024;
  private static final JsonParser JSON = new BasicJsonParser();

  @GetMapping("/{n}")
  public ResponseEntity<StepResponse> get(@PathVariable("id") String id,
      @PathVariable("n") String rawN, HttpServletRequest request) {
    shed();
    int n = stepNumber(rawN);
    DraftStore.Draft draft = visibleDraft(id, request);
    if (n >= 2) {
      throw Errors.fail(HttpStatus.UNAVAILABLE_FOR_LEGAL_REASONS, "STEP_UNPROBED",
          Map.of("n", n));
    }
    StepStore.StepRow row = StepStore.get(id, n);
    int version = row == null ? 1 : row.version();
    Map<String, Object> payload = row == null ? Map.of() : row.payload();
    String etag = etag(version);
    if (etagMatches(request.getHeader("If-None-Match"), etag)) {
      return ResponseEntity.status(HttpStatus.NOT_MODIFIED)
          .header("ETag", etag).build();
    }
    return ResponseEntity.ok().header("ETag", etag)
        .body(new StepResponse(n, payload, version));
  }

  @PutMapping("/{n}")
  public ResponseEntity<PutResponse> put(@PathVariable("id") String id,
      @PathVariable("n") String rawN, HttpServletRequest request,
      @RequestBody(required = false) byte[] raw) {
    long now = System.currentTimeMillis();
    shed();
    throttle(request, id, now);
    int n = stepNumber(rawN);
    DraftStore.Draft draft = visibleDraft(id, request);
    int maxN = StepStore.maxN(id);
    if (n > maxN + 1) {
      throw Errors.fail(HttpStatus.CONFLICT, "STEP_AHEAD",
          Map.of("currentMax", maxN));
    }
    if (n >= 2) {
      throw Errors.fail(HttpStatus.UNAVAILABLE_FOR_LEGAL_REASONS, "STEP_UNPROBED",
          Map.of("n", n));
    }
    if (raw != null && raw.length > BODY_CAP_BYTES) {
      throw Errors.fail(HttpStatus.PAYLOAD_TOO_LARGE, "PAYLOAD_TOO_LARGE");
    }
    Map<String, Object> payload = payload(raw);
    if (serialisedBytes(payload) > BODY_CAP_BYTES) {
      throw Errors.fail(HttpStatus.PAYLOAD_TOO_LARGE, "PAYLOAD_TOO_LARGE");
    }
    List<String> errors = StepValidator.validateStep1(payload);
    if (!errors.isEmpty()) {
      throw Errors.fail(HttpStatus.UNPROCESSABLE_ENTITY, "SCHEMA_INVALID",
          Map.of("errors", errors));
    }
    StepStore.StepRow current = StepStore.get(id, n);
    int currentVersion = current == null ? 1 : current.version();
    Integer ifMatch = parseIfMatch(request.getHeader("If-Match"));
    if (ifMatch == null || ifMatch != currentVersion) {
      throw Errors.fail(HttpStatus.CONFLICT, "VERSION_CONFLICT",
          Map.of("currentVersion", currentVersion));
    }
    StepStore.StepRow stored = StepStore.put(id, n, payload, ifMatch, now);
    if (stored == null) {
      StepStore.StepRow latest = StepStore.get(id, n);
      int latestVersion = latest == null ? 1 : latest.version();
      throw Errors.fail(HttpStatus.CONFLICT, "VERSION_CONFLICT",
          Map.of("currentVersion", latestVersion));
    }
    DraftStore.bump(id, now);
    log.info("step put id={} n={} version={}", id, n, stored.version());
    return ResponseEntity.ok().header("ETag", etag(stored.version()))
        .body(new PutResponse(n, stored.version(), StepStore.maxN(id)));
  }

  private DraftStore.Draft visibleDraft(String id, HttpServletRequest request) {
    Principal principal;
    try {
      principal = Auths.resolve(request);
    } catch (Exception e) {
      throw Errors.fail(HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED");
    }
    DraftStore.Draft draft = DraftStore.get(id);
    if (draft == null || DraftStore.purged(draft, System.currentTimeMillis())) {
      throw Errors.fail(HttpStatus.NOT_FOUND, "NOT_FOUND");
    }
    if ("discarded".equals(draft.status())) {
      throw Errors.fail(HttpStatus.GONE, "DISCARDED");
    }
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

  private int stepNumber(String rawN) {
    try {
      int n = Integer.parseInt(rawN);
      if (n >= 1 && n <= 6) {
        return n;
      }
    } catch (NumberFormatException e) {
      throw Errors.fail(HttpStatus.BAD_REQUEST, "BAD_REQUEST");
    }
    throw Errors.fail(HttpStatus.BAD_REQUEST, "BAD_REQUEST");
  }

  private Map<String, Object> payload(byte[] raw) {
    if (raw == null || raw.length == 0) {
      throw Errors.fail(HttpStatus.UNPROCESSABLE_ENTITY, "SCHEMA_INVALID",
          Map.of("errors", List.of("body must be an object")));
    }
    Map<String, Object> body;
    try {
      body = JSON.parseMap(new String(raw, StandardCharsets.UTF_8));
    } catch (Exception e) {
      throw Errors.fail(HttpStatus.UNPROCESSABLE_ENTITY, "SCHEMA_INVALID",
          Map.of("errors", List.of("malformed JSON")));
    }
    if (body == null) {
      throw Errors.fail(HttpStatus.UNPROCESSABLE_ENTITY, "SCHEMA_INVALID",
          Map.of("errors", List.of("body must be an object")));
    }
    Object inner = body.containsKey("payload") ? body.get("payload") : body;
    if (!(inner instanceof Map)) {
      throw Errors.fail(HttpStatus.UNPROCESSABLE_ENTITY, "SCHEMA_INVALID",
          Map.of("errors", List.of("payload must be an object")));
    }
    @SuppressWarnings("unchecked")
    Map<String, Object> payload = (Map<String, Object>) inner;
    return payload;
  }

  static int serialisedBytes(Map<String, Object> payload) {
    return jsonLength(payload);
  }

  private static int jsonLength(Object value) {
    if (value == null) {
      return 4;
    }
    if (value instanceof String s) {
      return s.getBytes(StandardCharsets.UTF_8).length + 2;
    }
    if (value instanceof Map<?, ?> map) {
      int total = 2;
      for (Map.Entry<?, ?> entry : map.entrySet()) {
        total += jsonLength(String.valueOf(entry.getKey())) + 1
            + jsonLength(entry.getValue()) + 1;
      }
      return total;
    }
    if (value instanceof List<?> list) {
      int total = 2;
      for (Object item : list) {
        total += jsonLength(item) + 1;
      }
      return total;
    }
    return String.valueOf(value).getBytes(StandardCharsets.UTF_8).length;
  }

  static String etag(int version) {
    return "\"v" + version + "\"";
  }

  static boolean etagMatches(String header, String etag) {
    if (header == null) {
      return false;
    }
    String norm = header.trim().replace("\"", "");
    return norm.equals(etag.replace("\"", ""));
  }

  static Integer parseIfMatch(String header) {
    if (header == null) {
      return null;
    }
    String digits = header.trim().replace("\"", "");
    if (digits.startsWith("v") || digits.startsWith("V")) {
      digits = digits.substring(1);
    }
    try {
      int version = Integer.parseInt(digits);
      return version >= 1 ? version : null;
    } catch (NumberFormatException e) {
      return null;
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
