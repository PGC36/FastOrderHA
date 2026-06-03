package com.fastorder.api_gateway.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.rate-limit")
public class RateLimitProperties {

	private boolean enabled = true;
	private boolean failOpen = true;
	private int capacity = 100000;
	private int windowSeconds = 60;
	private String keyPrefix = "fastorder:gateway:rate-limit";

	public boolean isEnabled() {
		return enabled;
	}

	public void setEnabled(boolean enabled) {
		this.enabled = enabled;
	}

	public boolean isFailOpen() {
		return failOpen;
	}

	public void setFailOpen(boolean failOpen) {
		this.failOpen = failOpen;
	}

	public int getCapacity() {
		return capacity;
	}

	public void setCapacity(int capacity) {
		this.capacity = capacity;
	}

	public int getWindowSeconds() {
		return windowSeconds;
	}

	public void setWindowSeconds(int windowSeconds) {
		this.windowSeconds = windowSeconds;
	}

	public String getKeyPrefix() {
		return keyPrefix;
	}

	public void setKeyPrefix(String keyPrefix) {
		this.keyPrefix = keyPrefix;
	}
}
