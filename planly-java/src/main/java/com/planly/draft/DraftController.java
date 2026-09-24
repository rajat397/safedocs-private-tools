package com.planly.draft;

import java.net.URLDecoder;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import com.planly.auth.AuthException;
import com.planly.auth.Auths;
import com.planly.auth.Principal;
import com.planly.common.Errors;
import com.planly.draft.DraftDtos.BindResponse;
import com.planly.draft.DraftDtos.DiscardResponse;
import com.planly.draft.DraftDtos.DraftResponse;
import com.planly.gen.IdempotencyKeys;
import com.planly.rate.RateLimitService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.json.BasicJsonParser;
import org.springframework.boot.json.JsonParser;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import jakarta.servlet.http.HttpServletRequest;

/**
 * Draft lifecycle: create (201 + draftId cookie), bind (idempotent merge),
 * discard (200 then 410), fetch (404 purged / 410 discarded).
 */
@RestController
@RequestMapping("/v1/drafts")
public class DraftController {

  private static final Logger log = LoggerFactory.getLogger(DraftController.class);
  private static final long COOKIE_MAX_AGE = 2592000L;
  private static final Set<String> NEXT_ALLOWLIST =
      Set.of("/planly", "/planly/draft", "/dashboard");
  private static final JsonParser JSON = new BasicJsonParser();

  @PostMapping
  public ResponseEntity<DraftResponse> create(HttpServletRequest request,
      @RequestBody(required = false) byte[] raw) {
    shed();
    String idemKey = request.getHeader("Idempotency-Key");
    if (idemKey != null && !idemKey.isBlank()) {
      if (!IdempotencyKeys.valid(idemKey)) {
        throw Errors.fail(HttpStatus.BAD_REQUEST, "BAD_IDEMPOTENCY_KEY");
      }
      String trimmedKey = idemKey.trim();
      DraftStore.Draft existing = DraftStore.getByIdempotencyKey(trimmedKey);
      if (existing != null) {
        log.info("draft replay id={} key={}", existing.id(), trimmedKey);
        return ResponseEntity.ok()
            .header(HttpHeaders.SET_COOKIE, draftCookie(existing.id()).toString())
            .body(new DraftResponse(existing.id(), existing.version(), existing.status()));
      }
    }
    Principal principal = authedOrAnon(request);
    if (raw != null && raw.length > 32 * 1024) {
      throw Errors.fail(HttpStatus.PAYLOAD_TOO_LARGE, "PAYLOAD_TOO_LARGE");
    }
    Map<String, Object> body = parseObject(raw, "BAD_REQUEST", HttpStatus.BAD_REQUEST);
    Object next = body.get("next");
    if (next != null && !(next instanceof String && validNext((String) next))) {
      throw Errors.fail(HttpStatus.BAD_REQUEST, "BAD_NEXT");
    }
    if (!principal.authed()) {
      long retry = RateLimitService.checkAnonDraft(Auths.clientIp(request),
          System.currentTimeMillis());
      if (retry > 0) {
        throw rateLimited(retry);
      }
    }
    long now = System.currentTimeMillis();
    DraftStore.Draft draft = DraftStore.create(principal.userId(), now);
    if (idemKey != null && !idemKey.isBlank()) {
      DraftStore.putIdempotencyKey(idemKey.trim(), draft.id());
    }
    log.info("draft created id={} authed={}", draft.id(), principal.authed());
    return created(draft);
  }

  @GetMapping("/{id}")
  public ResponseEntity<DraftResponse> fetch(@PathVariable("id") String id,
      HttpServletRequest request) {
    shed();
    Principal principal = resolve(request);
    if (!principal.authed() && principal.draftId() == null) {
      throw Errors.fail(HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED");
    }
    DraftStore.Draft draft = load(id);
    denyUnlessHolder(draft, principal);
    String etag = etag(draft.version());
    if (etagMatches(request.getHeader("If-None-Match"), etag)) {
      return ResponseEntity.status(HttpStatus.NOT_MODIFIED)
          .header("ETag", etag).build();
    }
    return ResponseEntity.ok().header("ETag", etag)
        .body(new DraftResponse(draft.id(), draft.version(), draft.status()));
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

  @PostMapping("/{id}/bind")
  public ResponseEntity<BindResponse> bind(@PathVariable("id") String id,
      HttpServletRequest request) {
    shed();
    Principal principal = resolve(request);
    if (!principal.authed() || principal.userId() == null) {
      throw Errors.fail(HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED");
    }
    DraftStore.Draft draft = load(id);
    DraftStore.BindResult result = DraftStore.bind(id, principal.userId(),
        System.currentTimeMillis());
    if (result == null) {
      throw Errors.fail(HttpStatus.NOT_FOUND, "NOT_FOUND");
    }
    if (result.foreign()) {
      throw Errors.fail(HttpStatus.FORBIDDEN, "FORBIDDEN");
    }
    DraftStore.Draft bound = result.draft();
    log.info("draft bind id={} merged={}", id, result.merged());
    return ResponseEntity.ok()
        .header(HttpHeaders.SET_COOKIE, draftCookie(bound.id()).toString())
        .body(new BindResponse(bound.id(), bound.ownerUserId(), result.merged()));
  }

  @PostMapping("/{id}/discard")
  public ResponseEntity<DiscardResponse> discard(@PathVariable("id") String id,
      HttpServletRequest request) {
    shed();
    DraftStore.Draft draft = load(id);
    denyUnlessHolder(draft, resolve(request));
    DraftStore.Draft discarded = DraftStore.discard(id, System.currentTimeMillis());
    log.info("draft discard id={}", id);
    return ResponseEntity.ok()
        .header(HttpHeaders.SET_COOKIE, clearedCookie().toString())
        .body(new DiscardResponse(discarded.id(), discarded.status()));
  }

  DraftStore.Draft load(String id) {
    DraftStore.Draft draft = DraftStore.get(id);
    long now = System.currentTimeMillis();
    if (draft == null || DraftStore.purged(draft, now)) {
      throw Errors.fail(HttpStatus.NOT_FOUND, "NOT_FOUND");
    }
    if ("discarded".equals(draft.status())) {
      throw Errors.fail(HttpStatus.GONE, "DISCARDED");
    }
    return draft;
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

  private Principal authedOrAnon(HttpServletRequest request) {
    try {
      return Auths.resolve(request);
    } catch (AuthException e) {
      throw Errors.fail(HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED");
    }
  }

  private Principal resolve(HttpServletRequest request) {
    try {
      return Auths.resolve(request);
    } catch (AuthException e) {
      throw Errors.fail(HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED");
    }
  }

  private void shed() {
    long retry = RateLimitService.checkGlobalShed(System.currentTimeMillis());
    if (retry > 0) {
      throw rateLimited(retry);
    }
  }

  public static RuntimeException rateLimited(long retryAfter) {
    throw new com.planly.common.RateLimited(retryAfter);
  }

  private ResponseEntity<DraftResponse> created(DraftStore.Draft draft) {
    return ResponseEntity.status(HttpStatus.CREATED)
        .header(HttpHeaders.SET_COOKIE, draftCookie(draft.id()).toString())
        .body(new DraftResponse(draft.id(), draft.version(), draft.status()));
  }

  static ResponseCookie draftCookie(String id) {
    return ResponseCookie.from("draftId", URLEncoder.encode(id, StandardCharsets.UTF_8))
        .httpOnly(true).secure(true).sameSite("Lax").path("/")
        .maxAge(Duration.ofSeconds(COOKIE_MAX_AGE)).build();
  }

  static ResponseCookie clearedCookie() {
    return ResponseCookie.from("draftId", "")
        .httpOnly(true).secure(true).sameSite("Lax").path("/")
        .maxAge(Duration.ZERO).build();
  }

  static boolean validNext(String next) {
    if (next == null || next.isEmpty()) {
      return true;
    }
    if (next.matches("(?i).*http:.*|.*%2f%2f.*")) {
      return false;
    }
    String decoded;
    try {
      decoded = URLDecoder.decode(next, StandardCharsets.UTF_8);
    } catch (IllegalArgumentException e) {
      return false;
    }
    try {
      if (!URLDecoder.decode(decoded, StandardCharsets.UTF_8).equals(decoded)) {
        return false;
      }
    } catch (IllegalArgumentException e) {
      return true;
    }
    if (decoded.contains("//") || decoded.contains("..")
        || decoded.matches("(?i).*http:.*")) {
      return false;
    }
    return NEXT_ALLOWLIST.contains(decoded);
  }

  static Map<String, Object> parseObject(byte[] raw, String code, HttpStatus status) {
    if (raw == null || raw.length == 0) {
      return Map.of();
    }
    try {
      Map<String, Object> parsed = JSON.parseMap(
          new String(raw, StandardCharsets.UTF_8));
      return parsed == null ? Map.of() : parsed;
    } catch (Exception e) {
      throw Errors.fail(status, code);
    }
  }

}
