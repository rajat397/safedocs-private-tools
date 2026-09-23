package com.planly.plan;

import java.util.Map;

/**
 * Sealed plan projection: unentitled callers get Teaser (full is null,
 * explicit so clients can tell teaser apart from error); entitled callers
 * get Full. Serialised only via {@link TeaserGuard#filter}.
 */
public sealed interface PlanView permits PlanView.Teaser, PlanView.Full {

  String id();

  int version();

  Map<String, Object> teaser();

  record Teaser(String id, int version, Map<String, Object> teaser)
      implements PlanView {
    public Map<String, Object> full() {
      return null;
    }
  }

  record Full(String id, int version, Map<String, Object> teaser,
      Map<String, Object> full) implements PlanView {
  }
}
