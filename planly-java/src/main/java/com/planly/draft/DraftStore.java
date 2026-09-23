package com.planly.draft;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Draft + identity-link memory lane (prod persists via Flyway V1 + RPCs).
 * Single-statement OCC lives in {@link #compareVersion}; no SELECT FOR UPDATE.
 */
public final class DraftStore {

  public static final long TTL_MS = 30L * 24 * 3600 * 1000;

  public record Draft(String id, String ownerUserId, String anonId, int version,
      String status, long createdAt, long updatedAt) {
    Draft withVersion(int next, long now) {
      return new Draft(id, ownerUserId, anonId, next, status, createdAt, now);
    }

    Draft withOwner(String userId, long now) {
      return new Draft(id, userId, anonId, version + 1, status, createdAt, now);
    }

    Draft discarded(long now) {
      return new Draft(id, ownerUserId, anonId, version, "discarded", createdAt, now);
    }
  }

  public record IdentityLink(String draftId, String anonId, String userId, long createdAt) {
  }

  private static final Map<String, Draft> DRAFTS = new ConcurrentHashMap<>();
  private static final Map<String, IdentityLink> LINKS = new ConcurrentHashMap<>();

  private DraftStore() {
  }

  public static Draft create(String ownerUserId, long now) {
    Draft draft = new Draft(UUID.randomUUID().toString(), ownerUserId,
        UUID.randomUUID().toString(), 1, "open", now, now);
    DRAFTS.put(draft.id(), draft);
    return draft;
  }

  public static Draft get(String id) {
    return DRAFTS.get(id);
  }

  public static boolean purged(Draft draft, long now) {
    return draft != null && draft.createdAt() + TTL_MS <= now;
  }

  /**
   * Single-statement style OCC bump: exactly one compare-and-set, no locking.
   * Returns the updated row, or null on version mismatch.
   */
  public static Draft compareVersion(String id, int expected, long now) {
    Draft current = DRAFTS.get(id);
    if (current == null || current.version() != expected) {
      return null;
    }
    Draft next = current.withVersion(expected + 1, now);
    return DRAFTS.replace(id, current, next) ? next : null;
  }

  /**
   * Unconditional version bump via the same single-CAS loop as
   * {@link #compareVersion} (no blind {@code put} after read, so concurrent
   * bumps cannot lose updates). Best-effort: returns the latest row when
   * contention exhausts retries.
   */
  public static Draft bump(String id, long now) {
    for (int attempt = 0; attempt < 8; attempt++) {
      Draft current = DRAFTS.get(id);
      if (current == null) {
        return null;
      }
      Draft next = current.withVersion(current.version() + 1, now);
      if (DRAFTS.replace(id, current, next)) {
        return next;
      }
    }
    return DRAFTS.get(id);
  }

  public static Draft markGenerated(String id, long now) {
    for (int attempt = 0; attempt < 8; attempt++) {
      Draft current = DRAFTS.get(id);
      if (current == null || !"open".equals(current.status())) {
        return current;
      }
      Draft next = new Draft(current.id(), current.ownerUserId(), current.anonId(),
          current.version(), "generated", current.createdAt(), now);
      if (DRAFTS.replace(id, current, next)) {
        return next;
      }
    }
    return DRAFTS.get(id);
  }

  public static Draft discard(String id, long now) {
    for (int attempt = 0; attempt < 8; attempt++) {
      Draft current = DRAFTS.get(id);
      if (current == null || "discarded".equals(current.status())) {
        return current;
      }
      Draft next = current.discarded(now);
      if (DRAFTS.replace(id, current, next)) {
        return next;
      }
    }
    return DRAFTS.get(id);
  }

  public static IdentityLink link(String draftId) {
    return LINKS.get(draftId);
  }

  /**
   * Idempotent lossless bind: first call wins and takes ownership, replays
   * report merged=false. Returns null when the draft is owned by another user.
   */
  public static BindResult bind(String draftId, String userId, long now) {
    Draft current = DRAFTS.get(draftId);
    if (current == null) {
      return null;
    }
    if (current.ownerUserId() != null && !current.ownerUserId().equals(userId)) {
      return new BindResult(false, true, current);
    }
    IdentityLink existing = LINKS.get(draftId);
    if (existing != null && existing.userId().equals(userId)) {
      return new BindResult(false, false, current);
    }
    if (current.ownerUserId() == null) {
      Draft owned = current.withOwner(userId, now);
      if (!DRAFTS.replace(draftId, current, owned)) {
        Draft raced = DRAFTS.get(draftId);
        if (raced == null) {
          return null;
        }
        if (raced.ownerUserId() != null && !raced.ownerUserId().equals(userId)) {
          return new BindResult(false, true, raced);
        }
        return new BindResult(false, false, raced);
      }
      LINKS.putIfAbsent(draftId,
          new IdentityLink(draftId, current.anonId(), userId, now));
      return new BindResult(true, false, owned);
    }
    LINKS.putIfAbsent(draftId, new IdentityLink(draftId, current.anonId(), userId, now));
    return new BindResult(false, false, current);
  }

  public record BindResult(boolean merged, boolean foreign, Draft draft) {
  }

  public static int purgeOlderThan(long cutoffMs) {
    int removed = 0;
    for (Map.Entry<String, Draft> entry : DRAFTS.entrySet()) {
      if (entry.getValue().createdAt() < cutoffMs) {
        if (DRAFTS.remove(entry.getKey(), entry.getValue())) {
          LINKS.remove(entry.getKey());
          removed++;
        }
      }
    }
    return removed;
  }

  public static void resetForTests() {
    DRAFTS.clear();
    LINKS.clear();
  }
}
