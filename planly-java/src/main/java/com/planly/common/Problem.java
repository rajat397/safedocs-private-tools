package com.planly.common;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * RFC 7807 problem+json envelope. Every error carries {@code code} plus the
 * request {@code requestId} from MDC so clients can correlate with logs.
 *
 * <p>Serialisation is hand-rolled ({@link #toJson}) with full string
 * escaping: the architecture guard bans Jackson imports under
 * {@code src/main}, so filters encode problem bodies through here instead
 * of string concatenation.
 */
public final class Problem {

  private Problem() {
  }

  public static Map<String, Object> of(String code, String requestId) {
    Map<String, Object> body = new LinkedHashMap<>();
    body.put("code", code);
    body.put("requestId", requestId);
    return body;
  }

  public static Map<String, Object> of(String code, String requestId,
      Map<String, Object> extra) {
    Map<String, Object> body = of(code, requestId);
    if (extra != null) {
      body.putAll(extra);
    }
    return body;
  }

  /** Encode a problem body as JSON with proper escaping (no raw concat). */
  public static String toJson(Map<String, Object> body) {
    StringBuilder out = new StringBuilder("{");
    boolean first = true;
    for (Map.Entry<String, Object> entry : body.entrySet()) {
      if (!first) {
        out.append(',');
      }
      first = false;
      appendString(out, String.valueOf(entry.getKey()));
      out.append(':');
      appendValue(out, entry.getValue());
    }
    return out.append('}').toString();
  }

  @SuppressWarnings("unchecked")
  private static void appendValue(StringBuilder out, Object value) {
    if (value == null) {
      out.append("null");
    } else if (value instanceof String text) {
      appendString(out, text);
    } else if (value instanceof Number || value instanceof Boolean) {
      out.append(String.valueOf(value));
    } else if (value instanceof List) {
      out.append('[');
      boolean first = true;
      for (Object item : (List<Object>) value) {
        if (!first) {
          out.append(',');
        }
        first = false;
        appendValue(out, item);
      }
      out.append(']');
    } else if (value instanceof Map) {
      out.append(toJson((Map<String, Object>) value));
    } else {
      appendString(out, String.valueOf(value));
    }
  }

  private static void appendString(StringBuilder out, String text) {
    out.append('"');
    for (int i = 0; i < text.length(); i++) {
      char c = text.charAt(i);
      switch (c) {
        case '"' -> out.append("\\\"");
        case '\\' -> out.append("\\\\");
        case '\n' -> out.append("\\n");
        case '\r' -> out.append("\\r");
        case '\t' -> out.append("\\t");
        case '\b' -> out.append("\\b");
        case '\f' -> out.append("\\f");
        default -> {
          if (c < 0x20) {
            out.append(String.format("\\u%04x", (int) c));
          } else {
            out.append(c);
          }
        }
      }
    }
    out.append('"');
  }
}
