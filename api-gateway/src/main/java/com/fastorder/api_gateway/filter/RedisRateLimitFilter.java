package com.fastorder.api_gateway.filter;

import com.fastorder.api_gateway.config.RateLimitProperties;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.time.Duration;
import java.util.Collections;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.dao.DataAccessException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class RedisRateLimitFilter extends OncePerRequestFilter {

	private static final String RATE_LIMIT_SCRIPT = """
			local current = redis.call('INCR', KEYS[1])
			if current == 1 then
				redis.call('EXPIRE', KEYS[1], ARGV[1])
			end
			return current
			""";

	private final RateLimitProperties properties;
	private final StringRedisTemplate redisTemplate;
	private final DefaultRedisScript<Long> rateLimitScript;

	public RedisRateLimitFilter(RateLimitProperties properties, StringRedisTemplate redisTemplate) {
		this.properties = properties;
		this.redisTemplate = redisTemplate;
		this.rateLimitScript = new DefaultRedisScript<>(RATE_LIMIT_SCRIPT, Long.class);
	}

	@Override
	protected boolean shouldNotFilter(HttpServletRequest request) {
		return !properties.isEnabled() || request.getRequestURI().startsWith("/actuator");
	}

	@Override
	protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
			throws ServletException, IOException {
		try {
			long current = incrementCounter(request);
			writeRateLimitHeaders(response, current);

			if (current > properties.getCapacity()) {
				writeLimitExceeded(response);
				return;
			}
		} catch (DataAccessException ex) {
			if (!properties.isFailOpen()) {
				writeRedisUnavailable(response);
				return;
			}
			response.setHeader("X-RateLimit-Redis", "unavailable");
		}

		filterChain.doFilter(request, response);
	}

	private long incrementCounter(HttpServletRequest request) {
		String key = properties.getKeyPrefix() + ":" + clientIp(request);
		Long current = redisTemplate.execute(
				rateLimitScript,
				Collections.singletonList(key),
				String.valueOf(Duration.ofSeconds(properties.getWindowSeconds()).toSeconds())
		);
		return current == null ? 0 : current;
	}

	private void writeRateLimitHeaders(HttpServletResponse response, long current) {
		long remaining = Math.max(0, properties.getCapacity() - current);
		response.setHeader("X-RateLimit-Limit", String.valueOf(properties.getCapacity()));
		response.setHeader("X-RateLimit-Remaining", String.valueOf(remaining));
		response.setHeader("X-RateLimit-Window-Seconds", String.valueOf(properties.getWindowSeconds()));
	}

	private void writeLimitExceeded(HttpServletResponse response) throws IOException {
		response.setStatus(429);
		response.setContentType("application/json");
		response.getWriter().write("""
				{"error":"rate_limit_exceeded","message":"Too many requests. Try again later."}
				""");
	}

	private void writeRedisUnavailable(HttpServletResponse response) throws IOException {
		response.setStatus(503);
		response.setContentType("application/json");
		response.getWriter().write("""
				{"error":"redis_unavailable","message":"Rate limiter is unavailable."}
				""");
	}

	private String clientIp(HttpServletRequest request) {
		String forwardedFor = request.getHeader("X-Forwarded-For");
		if (forwardedFor != null && !forwardedFor.isBlank()) {
			return forwardedFor.split(",")[0].trim();
		}
		return request.getRemoteAddr();
	}
}
