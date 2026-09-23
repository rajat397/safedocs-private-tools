package com.planly.plan;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * TeaserGuard runtime filter — the ONLY path that serialises plans to HTTP.
 * Default-deny: teaser is built from TEASER_ALLOWLIST, never by deleting from
 * a superset, so unlisted keys cannot leak. New fields default to full.
 * There is no bypass hatch: former {@code unsafeFull} was deleted, and both
 * views carry defensive (unmodifiable) copies so callers cannot mutate store
 * state. Teaser title/summary are sanitised (tags stripped) at the filter.
 */
public final class TeaserGuard {

  private static final Logger log = LoggerFactory.getLogger(TeaserGuard.class);
  public static final Set<String> TEASER_ALLOWLIST =
      Set.of("title", "summary", "stepCount", "priceRange");
  public static final int TITLE_MAX = 120;
  public static final int SUMMARY_MAX = 280;
  private static final Pattern TAGS = Pattern.compile("<[^>]*>");

  private TeaserGuard() {
  }

  public static PlanView filter(PlanStore.PlanRecord plan, boolean canReadFull) {
    Map<String, Object> teaser = new LinkedHashMap<>();
    for (String key : TEASER_ALLOWLIST) {
      if (plan.teaser().containsKey(key)) {
        teaser.put(key, plan.teaser().get(key));
      }
    }
    Object title = teaser.get("title");
    if (title instanceof String text) {
      teaser.put("title", truncate(sanitize(text), TITLE_MAX));
    }
    Object summary = teaser.get("summary");
    if (summary instanceof String text) {
      teaser.put("summary", truncate(sanitize(text), SUMMARY_MAX));
    }
    Map<String, Object> teaserCopy =
        Collections.unmodifiableMap(new LinkedHashMap<>(teaser));
    if (canReadFull) {
      log.info("teaser.serve mode=full id={}", plan.id());
      Map<String, Object> fullCopy = plan.full() == null ? null
          : Collections.unmodifiableMap(new LinkedHashMap<>(plan.full()));
      return new PlanView.Full(plan.id(), plan.version(), teaserCopy, fullCopy);
    }
    log.info("teaser.serve mode=teaser id={}", plan.id());
    return new PlanView.Teaser(plan.id(), plan.version(), teaserCopy);
  }

  /** Strip markup tags and trim; hand-rolled so no sanitizer dep is needed. */
  static String sanitize(String text) {
    return TAGS.matcher(text).replaceAll("").trim();
  }

  private static String truncate(String text, int max) {
    return text.length() > max ? text.substring(0, max) : text;
  }
}
