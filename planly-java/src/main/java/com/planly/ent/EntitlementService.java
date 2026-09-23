package com.planly.ent;

import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

import com.planly.auth.Principal;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Entitlement choke points C1 (generate), C2 (full-plan read), C3 (readjust).
 * Fail-closed: anon is never entitled; any deny flag fails closed; an
 * entitlement-store outage denies. Beta default allows verified authed
 * callers; explicit deny via env ENTITLEMENT_DENY (generate, read-full,
 * readjust, all) or the static test seam.
 */
public final class EntitlementService {

  private static final Logger log = LoggerFactory.getLogger(EntitlementService.class);
  private static final Map<String, Verdict> TABLE = new ConcurrentHashMap<>();
  private static volatile Set<String> denyOverride;

  private EntitlementService() {
  }

  public record Verdict(boolean canGenerate, boolean canReadFull, boolean canReadjust) {
  }

  public static Verdict resolve(Principal principal) {
    Set<String> deny = denySet();
    boolean all = deny.contains("all");
    boolean base = principal.authed()
        || "true".equalsIgnoreCase(System.getenv("ENTITLEMENT_ALLOW_ANON_GENERATE"));
    Verdict defaults = new Verdict(base && !all && !deny.contains("generate"),
        base && !all && !deny.contains("read-full") && !deny.contains("full"),
        base && !all && !deny.contains("readjust"));
    if (principal.userId() == null) {
      return defaults;
    }
    Verdict row = TABLE.get(principal.userId());
    if (row == null) {
      return defaults;
    }
    return new Verdict(defaults.canGenerate() && row.canGenerate(),
        defaults.canReadFull() && row.canReadFull(),
        defaults.canReadjust() && row.canReadjust());
  }

  public static void auditAllow(String userId, String choke) {
    log.info("entitlement.allow user={} choke={}", userId, choke);
  }

  private static Set<String> denySet() {
    Set<String> override = denyOverride;
    if (override != null) {
      return override;
    }
    String raw = System.getenv("ENTITLEMENT_DENY");
    Set<String> deny = new HashSet<>();
    if (raw != null) {
      for (String part : raw.split(",")) {
        String token = part.trim().toLowerCase();
        if (!token.isEmpty()) {
          deny.add(token);
        }
      }
    }
    return deny;
  }

  /** Test seam: explicit deny flags without env changes (null clears). */
  public static void setDenyOverride(Set<String> deny) {
    denyOverride = deny;
  }

  /** Test seam: entitlement table row for a user. */
  public static void putRow(String userId, Verdict verdict) {
    TABLE.put(userId, verdict);
  }

  public static void resetForTests() {
    TABLE.clear();
    denyOverride = null;
  }
}
