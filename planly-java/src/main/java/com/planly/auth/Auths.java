package com.planly.auth;

import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;

import com.planly.common.TrustedProxy;

import jakarta.servlet.http.HttpServletRequest;

/**
 * Principal resolution plus the shared owner-or-cookie access rule.
 * Cookie + verified JWT are authority; body draftIds are never trusted.
 */
public final class Auths {

  private Auths() {
  }

  public static Principal resolve(HttpServletRequest request) {
    String auth = request.getHeader("Authorization");
    String token = bearer(auth);
    String draftId = cookie(request.getHeader("Cookie"), "draftId");
    if (token == null) {
      return Principal.anon(draftId);
    }
    return new Principal(JwtVerifier.verify(token), draftId, true);
  }

  public static String bearer(String authHeader) {
    if (authHeader == null) {
      return null;
    }
    String trimmed = authHeader.trim();
    if (trimmed.length() < 8 || !trimmed.regionMatches(true, 0, "Bearer ", 0, 7)) {
      return null;
    }
    String token = trimmed.substring(7).trim();
    return token.isEmpty() ? null : token;
  }

  public static String cookie(String cookieHeader, String name) {
    if (cookieHeader == null) {
      return null;
    }
    for (String part : cookieHeader.split(";")) {
      int eq = part.indexOf('=');
      if (eq < 0) {
        continue;
      }
      if (!part.substring(0, eq).trim().equals(name)) {
        continue;
      }
      String raw = part.substring(eq + 1).trim();
      try {
        return URLDecoder.decode(raw, StandardCharsets.UTF_8);
      } catch (IllegalArgumentException e) {
        return raw;
      }
    }
    return null;
  }

  /**
   * Client IP via the trusted-proxy gate: proxy headers are honoured only
   * when the TCP peer is a configured trusted proxy, else the socket
   * address is used (spoof-proof by default).
   */
  public static String clientIp(HttpServletRequest request) {
    return TrustedProxy.clientIp(request);
  }

  /**
   * Owner-or-holder check. Returns null when allowed, else the failure kind:
   * 401 when the caller presents nothing, 403 when authenticated but foreign.
   */
  public static Access checkDraftAccess(Principal principal, String ownerUserId,
      String draftId) {
    if (ownerUserId != null) {
      if (principal.authed() && ownerUserId.equals(principal.userId())) {
        return null;
      }
      if (!principal.authed() && principal.draftId() == null) {
        return Access.UNAUTHENTICATED;
      }
      return Access.FORBIDDEN;
    }
    if (draftId.equals(principal.draftId())) {
      return null;
    }
    if (principal.authed() && principal.userId() != null) {
      return Access.FORBIDDEN;
    }
    if (principal.draftId() == null) {
      return Access.UNAUTHENTICATED;
    }
    return Access.FORBIDDEN;
  }

  public enum Access {
    UNAUTHENTICATED,
    FORBIDDEN
  }
}
