package com.planly.auth;

/**
 * Verified caller: JWT sub (null when anonymous), draftId cookie value,
 * and whether a Bearer token was presented and verified.
 */
public record Principal(String userId, String draftId, boolean authed) {

  public static Principal anon(String draftId) {
    return new Principal(null, draftId, false);
  }
}
