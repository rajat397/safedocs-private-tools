package com.planly.auth;

/**
 * Invalid, expired or forged credentials. Always surfaces as 401.
 */
public class AuthException extends RuntimeException {

  public AuthException(String message) {
    super(message);
  }

  public AuthException(String message, Throwable cause) {
    super(message, cause);
  }
}
