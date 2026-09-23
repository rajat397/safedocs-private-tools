package com.planly.auth;

import java.math.BigInteger;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.KeyFactory;
import java.security.PublicKey;
import java.security.Signature;
import java.security.spec.RSAPublicKeySpec;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Function;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Supabase JWT verification with a 10-minute JWKS cache (normative).
 * Secrets come from env only (JWKS_URL, SUPABASE_URL); no service-role key.
 *
 * <p>Fail-closed: when JWKS_URL is unset, verification throws
 * {@link AuthException} (401) unless the test-only lenient lane is explicitly
 * enabled via {@code APP_PROFILE=local|test} plus {@code AUTH_LENIENT=true}.
 * The lenient lane logs a startup warning and must never be enabled in prod.
 * A static test verifier overrides everything for unit tests.
 */
public final class JwtVerifier {

  private static final Logger log = LoggerFactory.getLogger(JwtVerifier.class);
  private static final long JWKS_TTL_MS = 10 * 60 * 1000;
  private static final Pattern STR_CLAIM = Pattern.compile("\"%s\"\\s*:\\s*\"([^\"]*)\"");
  private static final Pattern NUM_CLAIM = Pattern.compile("\"%s\"\\s*:\\s*(\\d+)");
  private static final AtomicBoolean LENIENT_WARNED = new AtomicBoolean(false);

  private static final AtomicLong CACHED_AT = new AtomicLong(0);
  private static final AtomicReference<String> CACHED_JWKS = new AtomicReference<>("");
  private static final AtomicReference<String> CACHED_URL = new AtomicReference<>("");
  private static volatile Function<String, String> testVerifier;

  private JwtVerifier() {
  }

  public static void setTestVerifier(Function<String, String> verifier) {
    testVerifier = verifier;
  }

  public static void resetForTests() {
    testVerifier = null;
    CACHED_AT.set(0);
    CACHED_JWKS.set("");
    CACHED_URL.set("");
  }

  public static String verify(String token) {
    if (token == null || token.isBlank()) {
      throw new AuthException("missing token");
    }
    Function<String, String> override = testVerifier;
    if (override != null) {
      String sub = override.apply(token.trim());
      if (sub == null || sub.isEmpty()) {
        throw new AuthException("forged or invalid sub");
      }
      return sub;
    }
    String jwksUrl = System.getenv("JWKS_URL");
    if (jwksUrl == null || jwksUrl.isBlank()) {
      if (!lenientAllowed()) {
        throw new AuthException("auth not configured");
      }
      warnLenientOnce();
      return lenientSubject(token.trim());
    }
    return strictVerify(token.trim(), jwksUrl);
  }

  /**
   * Test-only lenient lane gate: {@code APP_PROFILE=local|test} plus explicit
   * {@code AUTH_LENIENT=true}. Anything else (including unset profile) is
   * prod-like and fails closed. Public so the boot guard can reuse it.
   */
  public static boolean lenientAllowed() {
    String profile = System.getenv("APP_PROFILE");
    boolean local = profile != null
        && (profile.equalsIgnoreCase("local") || profile.equalsIgnoreCase("test"));
    return local && "true".equalsIgnoreCase(System.getenv("AUTH_LENIENT"));
  }

  private static void warnLenientOnce() {
    if (LENIENT_WARNED.compareAndSet(false, true)) {
      log.warn("auth lenient mode active (APP_PROFILE={} AUTH_LENIENT=true); "
          + "never enable in prod", System.getenv("APP_PROFILE"));
    }
  }

  private static String lenientSubject(String token) {
    if (token.contains(".")) {
      String[] parts = token.split("\\.", -1);
      if (parts.length == 3) {
        try {
          String payload = new String(decode(parts[1]), StandardCharsets.UTF_8);
          String sub = stringClaim(payload, "sub");
          if (sub != null && !sub.isEmpty()) {
            return sub;
          }
        } catch (IllegalArgumentException e) {
          log.debug("lenient jwt payload decode failed");
        }
      }
      throw new AuthException("malformed token");
    }
    if (!token.contains(" ") && token.length() <= 256) {
      return token;
    }
    throw new AuthException("malformed token");
  }

  private static String strictVerify(String token, String jwksUrl) {
    String[] parts = token.split("\\.", -1);
    if (parts.length != 3) {
      throw new AuthException("malformed token");
    }
    String headerJson = decodeJson(parts[0], "malformed token header");
    String payloadJson = decodeJson(parts[1], "malformed token claims");
    String alg = stringClaim(headerJson, "alg");
    if (!"RS256".equals(alg)) {
      throw new AuthException("unsupported alg (forged?)");
    }
    String kid = stringClaim(headerJson, "kid");
    if (kid == null || kid.isEmpty()) {
      throw new AuthException("missing kid");
    }
    long nowSec = System.currentTimeMillis() / 1000;
    Long exp = numberClaim(payloadJson, "exp");
    if (exp == null || exp <= nowSec) {
      throw new AuthException("expired token");
    }
    String supabaseUrl = System.getenv("SUPABASE_URL");
    if (supabaseUrl != null && !supabaseUrl.isBlank()) {
      String base = supabaseUrl.replaceAll("/$", "");
      String iss = stringClaim(payloadJson, "iss");
      if (!((base + "/auth/v1").equals(iss))) {
        throw new AuthException("bad iss");
      }
      String aud = stringClaim(payloadJson, "aud");
      if (!"authenticated".equals(aud)) {
        throw new AuthException("bad aud");
      }
    }
    String sub = stringClaim(payloadJson, "sub");
    if (sub == null || sub.isEmpty()) {
      throw new AuthException("missing sub");
    }
    String jwks = fetchJwks(jwksUrl);
    PublicKey key = selectKey(jwks, kid);
    byte[] signature;
    try {
      signature = decode(parts[2]);
    } catch (IllegalArgumentException e) {
      throw new AuthException("malformed signature", e);
    }
    try {
      Signature sig = Signature.getInstance("SHA256withRSA");
      sig.initVerify(key);
      sig.update((parts[0] + "." + parts[1]).getBytes(StandardCharsets.US_ASCII));
      if (!sig.verify(signature)) {
        throw new AuthException("bad signature (forged?)");
      }
    } catch (AuthException e) {
      throw e;
    } catch (Exception e) {
      throw new AuthException("signature verify failed", e);
    }
    return sub;
  }

  private static String decodeJson(String part, String error) {
    try {
      return new String(decode(part), StandardCharsets.UTF_8);
    } catch (IllegalArgumentException e) {
      throw new AuthException(error, e);
    }
  }

  private static byte[] decode(String part) {
    String padded = part.replace('-', '+').replace('_', '/');
    int pad = (4 - padded.length() % 4) % 4;
    padded += "====".substring(0, pad);
    return Base64.getDecoder().decode(padded);
  }

  private static String stringClaim(String json, String name) {
    Matcher m = Pattern.compile(String.format(STR_CLAIM.pattern(), name)).matcher(json);
    return m.find() ? m.group(1) : null;
  }

  private static Long numberClaim(String json, String name) {
    Matcher m = Pattern.compile(String.format(NUM_CLAIM.pattern(), name)).matcher(json);
    if (!m.find()) {
      return null;
    }
    try {
      return Long.parseLong(m.group(1));
    } catch (NumberFormatException e) {
      return null;
    }
  }

  private static String fetchJwks(String jwksUrl) {
    long now = System.currentTimeMillis();
    String cached = CACHED_JWKS.get();
    if (!cached.isEmpty() && CACHED_URL.get().equals(jwksUrl)
        && now - CACHED_AT.get() < JWKS_TTL_MS) {
      return cached;
    }
    try {
      HttpClient client = HttpClient.newBuilder()
          .connectTimeout(Duration.ofSeconds(5)).build();
      HttpRequest req = HttpRequest.newBuilder(URI.create(jwksUrl))
          .header("Accept", "application/json")
          .timeout(Duration.ofSeconds(5)).GET().build();
      HttpResponse<String> res = client.send(req, HttpResponse.BodyHandlers.ofString());
      if (res.statusCode() < 200 || res.statusCode() >= 300
          || res.body() == null || res.body().isBlank()) {
        throw new AuthException("jwks fetch failed");
      }
      CACHED_JWKS.set(res.body());
      CACHED_URL.set(jwksUrl);
      CACHED_AT.set(now);
      return res.body();
    } catch (AuthException e) {
      throw e;
    } catch (Exception e) {
      throw new AuthException("jwks fetch failed", e);
    }
  }

  private static PublicKey selectKey(String jwks, String kid) {
    List<String> keys = splitKeys(jwks);
    for (String key : keys) {
      if (kid.equals(stringClaim(key, "kid"))) {
        return rsaKey(key);
      }
    }
    throw new AuthException("unknown kid (forged?)");
  }

  private static List<String> splitKeys(String jwks) {
    List<String> out = new ArrayList<>();
    int depth = 0;
    int start = -1;
    for (int i = 0; i < jwks.length(); i++) {
      char c = jwks.charAt(i);
      if (c == '{') {
        if (depth == 1) {
          start = i;
        }
        depth++;
      } else if (c == '}') {
        depth--;
        if (depth == 1 && start >= 0) {
          out.add(jwks.substring(start, i + 1));
          start = -1;
        }
      }
    }
    return out;
  }

  private static PublicKey rsaKey(String jwk) {
    try {
      BigInteger n = new BigInteger(1, decode(requireClaim(jwk, "n")));
      BigInteger e = new BigInteger(1, decode(requireClaim(jwk, "e")));
      return KeyFactory.getInstance("RSA").generatePublic(new RSAPublicKeySpec(n, e));
    } catch (AuthException ex) {
      throw ex;
    } catch (Exception ex) {
      throw new AuthException("invalid jwk", ex);
    }
  }

  private static String requireClaim(String jwk, String name) {
    String value = stringClaim(jwk, name);
    if (value == null || value.isEmpty()) {
      throw new AuthException("invalid jwk");
    }
    return value;
  }
}
