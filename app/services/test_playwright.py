#!/usr/bin/env python3
"""
MiniMax TTS Browser Automation using Playwright
Supports cookie-based authentication for免登录
"""

import json
from pathlib import Path
from playwright.sync_api import sync_playwright


def load_cookies(cookie_file: str = "minimax_cookies.json") -> list:
    """Load cookies from JSON file and format for Playwright"""
    if Path(cookie_file).exists():
        with open(cookie_file, 'r') as f:
            raw_cookies = json.load(f)

        # Format cookies for Playwright
        formatted_cookies = []
        for cookie in raw_cookies:
            formatted = {
                'name': cookie.get('name', ''),
                'value': cookie.get('value', ''),
            }

            # Add url field for all cookies
            if 'domain' in cookie:
                formatted['domain'] = cookie['domain']
            else:
                formatted['url'] = 'https://www.minimax.io'

            # Add path if exists
            if 'path' in cookie:
                formatted['path'] = cookie['path']
            else:
                formatted['path'] = '/'

            # Add secure flag if exists
            if 'secure' in cookie:
                formatted['secure'] = cookie['secure']

            formatted_cookies.append(formatted)

        return formatted_cookies
    return []


def test_google():
    """Test opening Google homepage"""
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        page = browser.new_page()

        # Navigate to Google
        page.goto("https://www.google.com")

        # Wait for page to load
        page.wait_for_load_state("networkidle")

        print(f"Page title: {page.title()}")

        browser.close()
        print("Google test completed successfully!")


def test_minimax_with_cookie():
    """Test opening MiniMax TTS page with cookies for免登录"""
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        context = browser.new_context()

        # Load cookies for authentication
        cookies = load_cookies()

        print(f"Loading {len(cookies)} cookies for authentication...")

        # Add cookies to context
        for cookie in cookies:
            try:
                context.add_cookies([cookie])
                print(f"Added cookie: {cookie['name']}")
            except Exception as e:
                print(f"Failed to add cookie {cookie['name']}: {e}")

        # Create a new page with the authenticated context
        page = context.new_page()

        # Navigate to MiniMax TTS page
        print("Opening MiniMax TTS page...")
        page.goto("https://www.minimax.io/audio/text-to-speech")

        # Wait for page to load - use domcontentloaded instead of networkidle
        page.wait_for_load_state("domcontentloaded")
        page.wait_for_timeout(3000)  # Wait for JS to render

        # Check if logged in by looking for user avatar or name
        page.wait_for_timeout(2000)  # Wait for any animations

        print(f"Page title: {page.title()}")

        # Check URL to see if we're on the TTS page
        if "text-to-speech" in page.url:
            print("Successfully navigated to TTS page!")
        else:
            print(f"Navigation status: {page.url}")

        # Keep browser open for manual interaction if needed
        print("\nBrowser will stay open. Press Ctrl+C to close.")
        try:
            page.wait_for_timeout(300000)  # 5 minutes
        except KeyboardInterrupt:
            print("\nClosing browser...")

        browser.close()
        print("MiniMax test completed!")


if __name__ == "__main__":
    # Test MiniMax with cookies
    test_minimax_with_cookie()
