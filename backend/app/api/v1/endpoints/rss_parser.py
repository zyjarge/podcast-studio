from fastapi import APIRouter, HTTPException, Query
import httpx
import ipaddress
import logging
import re
import socket
from urllib.parse import urlparse

logger = logging.getLogger(__name__)

router = APIRouter()

# URL scheme gate and IP blocklist for SSRF defence (issue #5).
# Only http(s) is allowed, and the resolved host must not be in a
# private / loopback / link-local / reserved range.
_ALLOWED_SCHEMES = ("http", "https")

# Patterns we'd never hit legitimately; reject up-front to avoid
# obvious abuse vectors (file://, ftp://, gopher://, javascript:...).
_DISALLOWED_HOST_HINTS = (
    "localhost",   # exact match below is checked after resolution; this catches labels
    "metadata.google.internal",
    "metadata.aws.internal",
)


def _resolve_and_check(url: str) -> str:
    """Return the URL string if it is safe to fetch, else raise HTTPException.

    - Scheme must be http or https.
    - Hostname must resolve to a public IP (no private/loopback/link-local/reserved).
    """
    parsed = urlparse(url)
    if parsed.scheme.lower() not in _ALLOWED_SCHEMES:
        raise HTTPException(status_code=400, detail="only http(s) URLs are allowed")
    if not parsed.hostname:
        raise HTTPException(status_code=400, detail="missing hostname")

    host = parsed.hostname.lower()
    for hint in _DISALLOWED_HOST_HINTS:
        if hint in host:
            raise HTTPException(status_code=400, detail=f"host {host!r} is not allowed")

    # Resolve to one or more IPs and refuse anything non-public.
    try:
        infos = socket.getaddrinfo(host, None)
    except socket.gaierror as e:
        raise HTTPException(status_code=400, detail=f"cannot resolve host: {e}")

    seen = set()
    for info in infos:
        sockaddr = info[4]
        ip_str = sockaddr[0]
        if ip_str in seen:
            continue
        seen.add(ip_str)
        try:
            ip = ipaddress.ip_address(ip_str)
        except ValueError:
            continue
        if (
            ip.is_private
            or ip.is_loopback
            or ip.is_link_local
            or ip.is_reserved
            or ip.is_multicast
            or ip.is_unspecified
        ):
            raise HTTPException(
                status_code=400,
                detail=f"host {host!r} resolves to non-public IP {ip_str}",
            )
    return url


@router.get("/parse-rss")
async def parse_rss_title(url: str = Query(..., description="RSS feed URL")):
    """从 RSS URL 解析标题 (SSRF-hardened per issue #5).

    Defence in depth:
    1. Scheme allowlist (http/https only).
    2. Hostname hint blocklist (localhost, cloud metadata labels).
    3. DNS resolve + per-result IP filter (block private / loopback /
       link-local / reserved / multicast / unspecified ranges).
    4. Disable httpx follow-redirects so a redirect chain cannot bypass
       any of the above checks.
    """
    safe_url = _resolve_and_check(url)

    try:
        # follow_redirects=False ensures a redirect cannot pivot us onto
        # a private IP AFTER our IP check passed (e.g. http://attacker.com
        # -> 302 -> http://169.254.169.254/).
        async with httpx.AsyncClient(
            timeout=10.0, follow_redirects=False
        ) as client:
            response = await client.get(safe_url)

        # If a 3xx slipped through, refuse rather than chase it.
        if 300 <= response.status_code < 400:
            raise HTTPException(
                status_code=400,
                detail="redirects are not allowed for parse-rss",
            )

        text = response.text

        # Parse <title> tag (CDATA-aware).
        patterns = [
            r"<title><!\[CDATA\[([^\]]+)\]\]></title>",
            r"<title>([^<]+)</title>",
        ]

        for pattern in patterns:
            matches = re.findall(pattern, text, re.IGNORECASE)
            if matches:
                title = matches[0].strip()
                title = title.replace(" - RSS", "").replace(" | RSS", "").strip()
                return {"title": title}

        raise HTTPException(status_code=400, detail="无法解析标题")

    except httpx.RequestError as e:
        logger.error(f"Failed to fetch RSS: {e}")
        raise HTTPException(status_code=400, detail=f"无法访问该 URL: {str(e)}")
