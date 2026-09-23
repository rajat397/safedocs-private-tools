package com.planly.step;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Per-step payload validation. Creation-core probes Step 1 strictly;
 * Steps 2-6 stay unprobed placeholders (422 STEP_UNPROBED on PUT).
 */
public final class StepValidator {

  private static final Set<String> PREP_OPTIONS =
      Set.of("30", "60", "90", "120", "custom");

  private StepValidator() {
  }

  public static List<String> validateStep1(Map<String, Object> payload) {
    List<String> errors = new ArrayList<>();
    Object prep = payload.get("prepDays");
    Object custom = payload.get("customDays");
    if (prep != null) {
      if (!(prep instanceof String) || !PREP_OPTIONS.contains(prep)) {
        errors.add("Select how many days you want to prepare.");
      } else if ("custom".equals(prep) && !validCustom(custom)) {
        errors.add("Enter a number between 7 and 365.");
      }
    } else if (custom != null && !validCustom(custom)) {
      errors.add("Enter a number between 7 and 365.");
    }
    Object name = payload.get("planName");
    if (name != null && !(name instanceof String
        && ((String) name).length() >= 1 && ((String) name).length() <= 60)) {
      errors.add("Enter a plan name (1-60 characters).");
    }
    return errors;
  }

  private static boolean validCustom(Object custom) {
    if (!(custom instanceof Number)) {
      return false;
    }
    long days = ((Number) custom).longValue();
    return days >= 7 && days <= 365;
  }

  public static boolean validDate(String date) {
    if (date == null) {
      return false;
    }
    try {
      LocalDate.parse(date);
      return true;
    } catch (Exception e) {
      return false;
    }
  }
}
