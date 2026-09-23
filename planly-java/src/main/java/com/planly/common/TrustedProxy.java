package com.planly.common;

import jakarta.servlet.http.HttpServletRequest;

/**
 * Trusted-proxy gate for proxy headers. {@code CF-Connecting-IP},
 * {@code X-Forwarded-For} and {@code X-Forwarded-Host} are honoured ONLY
 * when the TCP peer is a configured trusted proxy
 * ({@code TRUSTED_PROXIES} env: comma-separated IPs or IPv4 CIDRs);
 * otherwise the direct socket address/host is used, so spoofed headers
 * from untrusted clients cannot fake IPs or hosts. Unset means trust none.
 */
public final class TrustedProxy {

  private TrustedProxy() {
  }

  // Test seam for the TRUSTED_PROXIES env gate (mirrors the resetForTests
  // seams elsewhere): null override reads the real env; set override (even
  // null/blank) forces that value. Cleared after each test.
  private static volatile String trustedProxiesOverride;
  private static volatile boolean overrideActive;

  static void setTrustedProxiesForTests(String value) {
    trustedProxiesOverride = value;
    overrideActive = true;
  }

  static void clearTrustedProxiesForTests() {
    trustedProxiesOverride = null;
    overrideActive = false;
  }

  private static String configured() {
    if (overrideActive) {
      return trustedProxiesOverride;
    }
    return System.getenv("TRUSTED_PROXIES");
  }

  public static boolean isTrusted(String remoteAddr) {
    String configured = configured();
    if (configured == null || configured.isBlank() || remoteAddr == null) {
      return false;
    }
    String peer = remoteAddr.trim();
    for (String part : configured.split(",")) {
      String entry = part.trim();
      if (entry.isEmpty()) {
        continue;
      }
      if (entry.contains("/")) {
        if (cidrMatch(entry, peer)) {
          return true;
        }
      } else if (entry.equalsIgnoreCase(peer)) {
        return true;
      }
    }
    return false;
  }

  public static String clientIp(HttpServletRequest request) {
    String remote = request.getRemoteAddr();
    if (!isTrusted(remote)) {
      return remote == null ? "unknown" : remote;
    }
    String cf = request.getHeader("CF-Connecting-IP");
    if (cf != null && !cf.isBlank()) {
      return cf.trim();
    }
    String forwarded = request.getHeader("X-Forwarded-For");
    if (forwarded != null && !forwarded.isBlank()) {
      return forwarded.split(",")[0].trim();
    }
    return remote == null ? "unknown" : remote;
  }

  public static String forwardedHost(HttpServletRequest request) {
    if (!isTrusted(request.getRemoteAddr())) {
      return null;
    }
    String host = request.getHeader("X-Forwarded-Host");
    return host == null || host.isBlank() ? null : host.trim();
  }

  static boolean cidrMatch(String cidr, String ip) {
    try {
      if (cidr == null || ip == null) {
        return false;
      }
      int slash = cidr.indexOf('/');
      if (slash < 0) {
        return false;
      }
      int[] net = quad(cidr.substring(0, slash).trim());
      int[] addr = quad(ip);
      int bits = Integer.parseInt(cidr.substring(slash + 1).trim());
      if (bits < 0 || bits > 32) {
        return false;
      }
      int netInt = toInt(net);
      int addrInt = toInt(addr);
      int mask = bits == 0 ? 0 : -1 << (32 - bits);
      return (netInt & mask) == (addrInt & mask);
    } catch (RuntimeException e) {
      return false;
    }
  }

  private static int[] quad(String ip) {
    String[] parts = ip.split("\\.", -1);
    if (parts.length != 4) {
      throw new IllegalArgumentException("not IPv4");
    }
    int[] out = new int[4];
    for (int i = 0; i < 4; i++) {
      out[i] = Integer.parseInt(parts[i]);
      if (out[i] < 0 || out[i] > 255) {
        throw new IllegalArgumentException("octet out of range");
      }
    }
    return out;
  }

  private static int toInt(int[] quad) {
    return (quad[0] << 24) | (quad[1] << 16) | (quad[2] << 8) | quad[3];
  }
}
