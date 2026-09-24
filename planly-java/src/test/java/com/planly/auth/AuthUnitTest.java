package com.planly.auth;

import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.math.BigInteger;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.Signature;
import java.security.interfaces.RSAPublicKey;
import java.util.Base64;

import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Unit coverage for principal resolution, the access matrix, the test-verifier
 * seam, the lenient lane (open via APP_PROFILE=test + AUTH_LENIENT=true in
 * surefire env) and the strict RS256 lane (driven directly, with a loopback
 * JWKS server — no external network, no secrets).
 */
class AuthUnitTest {

  @BeforeEach
  void reset() {
    JwtVerifier.resetForTests();
  }

  @AfterEach
  void clean() {
    JwtVerifier.resetForTests();
  }

  @Test
  void bearerParsing() {
    assertThat(Auths.bearer(null)).isNull();
    assertThat(Auths.bearer("Bearer abc")).isEqualTo("abc");
    assertThat(Auths.bearer("bearer abc")).isEqualTo("abc");
    assertThat(Auths.bearer("  Bearer   abc  ")).isEqualTo("abc");
    assertThat(Auths.bearer("Bearer ")).isNull();
    assertThat(Auths.bearer("Token abc")).isNull();
    assertThat(Auths.bearer("short")).isNull();
  }

  @Test
  void cookieParsing() {
    assertThat(Auths.cookie(null, "draftId")).isNull();
    assertThat(Auths.cookie("a=1; draftId=abc; b=2", "draftId")).isEqualTo("abc");
    assertThat(Auths.cookie("draftId=a%20b", "draftId")).isEqualTo("a b");
    assertThat(Auths.cookie("other=1", "draftId")).isNull();
    assertThat(Auths.cookie("nocookie", "draftId")).isNull();
    assertThat(Auths.cookie("draftId=%", "draftId")).isEqualTo("%");
  }

  @Test
  void accessMatrix() {
    Principal owner = new Principal("u1", null, true);
    Principal stranger = new Principal("u2", null, true);
    Principal holder = Principal.anon("d1");
    Principal empty = Principal.anon(null);

    assertThat(Auths.checkDraftAccess(owner, "u1", "d1")).isNull();
    assertThat(Auths.checkDraftAccess(empty, "u1", "d1"))
        .isEqualTo(Auths.Access.UNAUTHENTICATED);
    assertThat(Auths.checkDraftAccess(holder, "u1", "d1"))
        .isEqualTo(Auths.Access.FORBIDDEN);
    assertThat(Auths.checkDraftAccess(stranger, "u1", "d1"))
        .isEqualTo(Auths.Access.FORBIDDEN);

    assertThat(Auths.checkDraftAccess(holder, null, "d1")).isNull();
    assertThat(Auths.checkDraftAccess(owner, null, "d1"))
        .isEqualTo(Auths.Access.FORBIDDEN);
    assertThat(Auths.checkDraftAccess(empty, null, "d1"))
        .isEqualTo(Auths.Access.UNAUTHENTICATED);
    assertThat(Auths.checkDraftAccess(Principal.anon("other"), null, "d1"))
        .isEqualTo(Auths.Access.FORBIDDEN);
  }

  @Test
  void resolveAndClientIp() {
    MockHttpServletRequest anon = new MockHttpServletRequest();
    anon.setRemoteAddr("9.9.9.9");
    Principal bare = Auths.resolve(anon);
    assertThat(bare.authed()).isFalse();
    assertThat(Auths.clientIp(anon)).isEqualTo("9.9.9.9");

    JwtVerifier.setTestVerifier(token -> "sub".equals(token) ? "u7" : null);
    MockHttpServletRequest authed = new MockHttpServletRequest();
    authed.addHeader("Authorization", "Bearer sub");
    assertThat(Auths.resolve(authed).userId()).isEqualTo("u7");
    MockHttpServletRequest forged = new MockHttpServletRequest();
    forged.addHeader("Authorization", "Bearer forged");
    assertThatThrownBy(() -> Auths.resolve(forged)).isInstanceOf(AuthException.class);
  }

  @Test
  void verifyGuardsAndTestSeam() {
    assertThatThrownBy(() -> JwtVerifier.verify(null)).isInstanceOf(AuthException.class);
    assertThatThrownBy(() -> JwtVerifier.verify("  ")).isInstanceOf(AuthException.class);

    JwtVerifier.setTestVerifier(token -> "good".equals(token) ? "u1" : "");
    assertThat(JwtVerifier.verify("good")).isEqualTo("u1");
    assertThatThrownBy(() -> JwtVerifier.verify("bad")).isInstanceOf(AuthException.class);
    JwtVerifier.resetForTests();
  }

  @Test
  void lenientLaneUsesEnvGate() {
    // Surefire sets APP_PROFILE=test + AUTH_LENIENT=true, so the lenient lane
    // is open here (JWKS_URL stays unset on purpose).
    assertThat(JwtVerifier.lenientAllowed()).isTrue();
    assertThat(JwtVerifier.verify("opaque-test-token")).isEqualTo("opaque-test-token");

    String payload = base64("{\"sub\":\"lenient-user\"}");
    assertThat(JwtVerifier.verify("h." + payload + ".s")).isEqualTo("lenient-user");

    assertThatThrownBy(() -> JwtVerifier.verify("has space in it"))
        .isInstanceOf(AuthException.class);
    assertThatThrownBy(() -> JwtVerifier.verify("a.b.c.d"))
        .isInstanceOf(AuthException.class);
  }

  // ---- strict lane via reflection (no env knobs needed) ----

  private static String strict(String token, String jwksUrl) {
    try {
      Method method = JwtVerifier.class.getDeclaredMethod("strictVerify",
          String.class, String.class);
      method.setAccessible(true);
      return (String) method.invoke(null, token, jwksUrl);
    } catch (InvocationTargetException e) {
      Throwable cause = e.getCause();
      if (cause instanceof RuntimeException runtime) {
        throw runtime;
      }
      throw new IllegalStateException(cause);
    } catch (ReflectiveOperationException e) {
      throw new IllegalStateException(e);
    }
  }

  private static String base64(String json) {
    return Base64.getUrlEncoder().withoutPadding()
        .encodeToString(json.getBytes(StandardCharsets.UTF_8));
  }

  private static String token(String header, String payload, String sig) {
    return base64(header) + "." + base64(payload) + "." + sig;
  }

  @Test
  void strictRejectsMalformedAndClaims() {
    String jwks = "http://127.0.0.1:9/jwks";
    assertThatThrownBy(() -> strict("abc", jwks)).hasMessage("malformed token");
    assertThatThrownBy(() -> strict("!!!.e30.e30", jwks))
        .hasMessage("malformed token header");
    assertThatThrownBy(
        () -> strict(token("{\"alg\":\"none\"}", "{}", "s"), jwks))
        .hasMessageContaining("unsupported alg");
    assertThatThrownBy(
        () -> strict(token("{\"alg\":\"RS256\"}", "{}", "s"), jwks))
        .hasMessage("missing kid");
    assertThatThrownBy(() -> strict(
        token("{\"alg\":\"RS256\",\"kid\":\"k\"}", "{\"exp\":1}", "s"), jwks))
        .hasMessage("expired token");
    // SUPABASE_URL=http://localhost:54321 is set in surefire env, so iss/aud
    // are enforced here.
    String future = "{\"exp\":9999999999,\"iss\":\"https://evil/auth/v1\","
        + "\"aud\":\"authenticated\",\"sub\":\"u\"}";
    assertThatThrownBy(() -> strict(
        token("{\"alg\":\"RS256\",\"kid\":\"k\"}", future, "s"), jwks))
        .hasMessage("bad iss");
    String badAud = "{\"exp\":9999999999,\"iss\":\"http://localhost:54321/auth/v1\","
        + "\"aud\":\"nope\",\"sub\":\"u\"}";
    assertThatThrownBy(() -> strict(
        token("{\"alg\":\"RS256\",\"kid\":\"k\"}", badAud, "s"), jwks))
        .hasMessage("bad aud");
    String noSub = "{\"exp\":9999999999,\"iss\":\"http://localhost:54321/auth/v1\","
        + "\"aud\":\"authenticated\"}";
    assertThatThrownBy(() -> strict(
        token("{\"alg\":\"RS256\",\"kid\":\"k\"}", noSub, "s"), jwks))
        .hasMessage("missing sub");
    String okClaims = "{\"exp\":9999999999,\"iss\":\"http://localhost:54321/auth/v1\","
        + "\"aud\":\"authenticated\",\"sub\":\"u\"}";
    assertThatThrownBy(() -> strict(
        token("{\"alg\":\"RS256\",\"kid\":\"k\"}", okClaims, "s"), jwks))
        .hasMessage("jwks fetch failed");
  }

  @Test
  void strictVerifiesSignatureAgainstJwks() throws Exception {
    KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
    generator.initialize(2048);
    KeyPair pair = generator.generateKeyPair();
    RSAPublicKey publicKey = (RSAPublicKey) pair.getPublic();
    String jwks = "{\"keys\":[{\"kty\":\"RSA\",\"kid\":\"k1\",\"n\":\""
        + base64Url(publicKey.getModulus()) + "\",\"e\":\""
        + base64Url(publicKey.getPublicExponent()) + "\"}]}";

    HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
    server.createContext("/jwks", exchange -> {
      byte[] body = jwks.getBytes(StandardCharsets.UTF_8);
      exchange.getResponseHeaders().add("Content-Type", "application/json");
      exchange.sendResponseHeaders(200, body.length);
      exchange.getResponseBody().write(body);
      exchange.close();
    });
    server.createContext("/empty", exchange -> {
      byte[] body = "{\"keys\":[]}".getBytes(StandardCharsets.UTF_8);
      exchange.sendResponseHeaders(200, body.length);
      exchange.getResponseBody().write(body);
      exchange.close();
    });
    server.createContext("/broken", exchange -> {
      exchange.sendResponseHeaders(500, -1);
      exchange.close();
    });
    server.createContext("/nokeys", exchange -> {
      byte[] body = "{\"keys\":[{\"kid\":\"k1\"}]}".getBytes(StandardCharsets.UTF_8);
      exchange.sendResponseHeaders(200, body.length);
      exchange.getResponseBody().write(body);
      exchange.close();
    });
    server.start();
    try {
      String base = "http://127.0.0.1:" + server.getAddress().getPort();
      String header = "{\"alg\":\"RS256\",\"kid\":\"k1\"}";
      String payload = "{\"exp\":9999999999,"
          + "\"iss\":\"http://localhost:54321/auth/v1\","
          + "\"aud\":\"authenticated\",\"sub\":\"jwks-user\"}";
      String signingInput = base64(header) + "." + base64(payload);
      Signature signer = Signature.getInstance("SHA256withRSA");
      signer.initSign(pair.getPrivate());
      signer.update(signingInput.getBytes(StandardCharsets.US_ASCII));
      String sig = base64Url(signer.sign());
      String good = signingInput + "." + sig;

      assertThat(strict(good, base + "/jwks")).isEqualTo("jwks-user");
      // Second call hits the 10-minute JWKS cache (no new fetch needed).
      assertThat(strict(good, base + "/jwks")).isEqualTo("jwks-user");

      String tampered = signingInput + "." + sig.substring(0, sig.length() - 2) + "AA";
      assertThatThrownBy(() -> strict(tampered, base + "/jwks"))
          .hasMessageContaining("bad signature");

      assertThatThrownBy(() -> strict(good, base + "/empty"))
          .hasMessageContaining("unknown kid");
      assertThatThrownBy(() -> strict(good, base + "/broken"))
          .hasMessage("jwks fetch failed");
      assertThatThrownBy(() -> strict(good, base + "/nokeys"))
          .hasMessage("invalid jwk");
    } finally {
      server.stop(0);
    }
    JwtVerifier.resetForTests();
  }

  @Test
  void jwtVerifierBranchCoverage() {
    // Test verify with null/blank token
    assertThatThrownBy(() -> JwtVerifier.verify(null))
        .isInstanceOf(AuthException.class)
        .hasMessage("missing token");
    assertThatThrownBy(() -> JwtVerifier.verify("  "))
        .isInstanceOf(AuthException.class)
        .hasMessage("missing token");

    // Test verify with test verifier returning null/empty sub
    JwtVerifier.setTestVerifier(token -> null);
    assertThatThrownBy(() -> JwtVerifier.verify("good"))
        .isInstanceOf(AuthException.class)
        .hasMessage("forged or invalid sub");

    JwtVerifier.setTestVerifier(token -> "");
    assertThatThrownBy(() -> JwtVerifier.verify("good"))
        .isInstanceOf(AuthException.class)
        .hasMessage("forged or invalid sub");

    JwtVerifier.setTestVerifier(token -> "valid-sub");
    assertThat(JwtVerifier.verify("good")).isEqualTo("valid-sub");
    JwtVerifier.resetForTests();

    // Test lenientAllowed branches (APP_PROFILE=test, AUTH_LENIENT=true in surefire)
    // Can't easily test the false branch without env manipulation, but we can test the method directly
    // The lenientAllowed is public static, we can test it reflects env
    // In surefire it's true, so we just verify it's true here
    assertThat(JwtVerifier.lenientAllowed()).isTrue();

    // Test numberClaim branch (null return)
    try {
      java.lang.reflect.Method method = JwtVerifier.class.getDeclaredMethod("numberClaim", String.class, String.class);
      method.setAccessible(true);
      // Missing claim
      Long result = (Long) method.invoke(null, "{}", "exp");
      assertThat(result).isNull();

      // Invalid number format
      result = (Long) method.invoke(null, "{\"exp\":\"not-a-number\"}", "exp");
      assertThat(result).isNull();

      // Valid number
      result = (Long) method.invoke(null, "{\"exp\":12345}", "exp");
      assertThat(result).isEqualTo(12345L);
    } catch (Exception e) {
      throw new RuntimeException(e);
    }

    // Test splitKeys branch (empty keys)
    try {
      java.lang.reflect.Method method = JwtVerifier.class.getDeclaredMethod("splitKeys", String.class);
      method.setAccessible(true);
      @SuppressWarnings("unchecked")
      java.util.List<String> keys = (java.util.List<String>) method.invoke(null, "{\"keys\":[]}");
      assertThat(keys).isEmpty();

      // Malformed JWKS (no keys array)
      keys = (java.util.List<String>) method.invoke(null, "{}");
      assertThat(keys).isEmpty();

      // Valid JWKS with one key
      keys = (java.util.List<String>) method.invoke(null, "{\"keys\":[{\"kid\":\"k1\",\"n\":\"n1\",\"e\":\"e1\"}]}");
      assertThat(keys).hasSize(1);
    } catch (Exception e) {
      throw new RuntimeException(e);
    }

    // Test requireClaim branch (missing claim)
    try {
      java.lang.reflect.Method method = JwtVerifier.class.getDeclaredMethod("requireClaim", String.class, String.class);
      method.setAccessible(true);
      try {
        method.invoke(null, "{}", "n");
        assertThat(false).isTrue(); // should not reach
      } catch (java.lang.reflect.InvocationTargetException ex) {
        assertThat(ex.getCause()).isInstanceOf(AuthException.class);
        assertThat(ex.getCause()).hasMessageContaining("invalid jwk");
      }
    } catch (Exception e) {
      throw new RuntimeException(e);
    }
  }

  private static String base64Url(BigInteger value) {
    byte[] bytes = value.toByteArray();
    if (bytes.length > 1 && bytes[0] == 0) {
      byte[] trimmed = new byte[bytes.length - 1];
      System.arraycopy(bytes, 1, trimmed, 0, trimmed.length);
      bytes = trimmed;
    }
    return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
  }

  private static String base64Url(byte[] bytes) {
    return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
  }
}
