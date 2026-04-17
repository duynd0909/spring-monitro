package com.spring.monitro.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.web.filter.GenericFilterBean;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Base64;

/**
 * Pure servlet filter enforcing HTTP Basic Auth on the admin port.
 * No Spring Security dependency — registered directly via FilterRegistrationBean
 * in the child Tomcat context, leaving the parent app's security chain untouched.
 *
 * Constant-time comparison (MessageDigest.isEqual on SHA-256 hashes) prevents
 * timing-based credential enumeration.
 */
public class MonitorAuthenticationFilter extends GenericFilterBean {

    private final String username;
    private final byte[] passwordHash;
    private final String realm;

    public MonitorAuthenticationFilter(String username, String password, String realm) {
        this.username = username;
        this.passwordHash = sha256(password);
        this.realm = realm;
    }

    @Override
    public void doFilter(ServletRequest req, ServletResponse res, FilterChain chain)
            throws IOException, ServletException {

        HttpServletRequest request = (HttpServletRequest) req;
        HttpServletResponse response = (HttpServletResponse) res;

        String authHeader = request.getHeader("Authorization");
        if (authHeader != null && authHeader.startsWith("Basic ")) {
            String decoded = new String(
                    Base64.getDecoder().decode(authHeader.substring(6)),
                    StandardCharsets.UTF_8);
            int colon = decoded.indexOf(':');
            if (colon > 0) {
                String u = decoded.substring(0, colon);
                String p = decoded.substring(colon + 1);
                if (username.equals(u) && MessageDigest.isEqual(sha256(p), passwordHash)) {
                    chain.doFilter(req, res);
                    return;
                }
            }
        }

        response.setHeader("WWW-Authenticate", "Basic realm=\"" + realm + "\"");
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
    }

    private static byte[] sha256(String text) {
        try {
            return MessageDigest.getInstance("SHA-256")
                    .digest(text.getBytes(StandardCharsets.UTF_8));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }
}
