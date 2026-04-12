import dns from 'dns';
import net from 'net';

/**
 * Private/reserved IP ranges that must never be webhook targets.
 * Covers loopback, link-local, RFC1918, cloud metadata, and other IANA reserved blocks.
 */
const BLOCKED_CIDRS: Array<{ base: number; mask: number }> = [
  { base: ip('10.0.0.0'), mask: 0xff000000 }, // 10/8
  { base: ip('172.16.0.0'), mask: 0xfff00000 }, // 172.16-31/12
  { base: ip('192.168.0.0'), mask: 0xffff0000 }, // 192.168/16
  { base: ip('127.0.0.0'), mask: 0xff000000 }, // loopback 127/8
  { base: ip('169.254.0.0'), mask: 0xffff0000 }, // link-local / cloud metadata
  { base: ip('0.0.0.0'), mask: 0xff000000 }, // 0/8 (this-host)
  { base: ip('100.64.0.0'), mask: 0xffc00000 }, // shared address space (CGNAT)
  { base: ip('192.0.0.0'), mask: 0xffffff00 }, // IETF protocol assignments
  { base: ip('192.0.2.0'), mask: 0xffffff00 }, // TEST-NET-1
  { base: ip('198.51.100.0'), mask: 0xffffff00 }, // TEST-NET-2
  { base: ip('203.0.113.0'), mask: 0xffffff00 }, // TEST-NET-3
  { base: ip('240.0.0.0'), mask: 0xf0000000 }, // reserved/broadcast
];

function ip(s: string): number {
  return s.split('.').reduce((acc, octet) => ((acc << 8) | parseInt(octet, 10)) >>> 0, 0);
}

function isPrivateIPv4(address: string): boolean {
  if (!net.isIPv4(address)) return true; // block IPv6 except ::1 handled separately
  const n = ip(address);
  return BLOCKED_CIDRS.some(({ base, mask }) => (n & mask) === base);
}

function isPrivateIPv6(address: string): boolean {
  // Block loopback ::1, link-local fe80::/10, and ULA fc00::/7
  const lower = address.toLowerCase();
  return (
    lower === '::1' || lower.startsWith('fe80') || lower.startsWith('fc') || lower.startsWith('fd')
  );
}

/**
 * Resolves the hostname and rejects if it resolves to a private/internal IP.
 * Throws an Error if the URL is unsafe.
 */
export async function assertSafeWebhookUrl(rawUrl: string): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('Invalid webhook URL.');
  }

  if (parsed.protocol !== 'https:') {
    throw new Error('Webhook URL must use HTTPS.');
  }

  const hostname = parsed.hostname;

  // Reject obvious internal hostnames before DNS
  if (
    hostname === 'localhost' ||
    hostname === '::1' ||
    net.isIPv4(hostname) ||
    net.isIPv6(hostname)
  ) {
    if (net.isIPv4(hostname) && isPrivateIPv4(hostname)) {
      throw new Error('Webhook URL resolves to a private/internal address.');
    }
    if (net.isIPv6(hostname) && isPrivateIPv6(hostname)) {
      throw new Error('Webhook URL resolves to a private/internal address.');
    }
    if (hostname === 'localhost') {
      throw new Error('Webhook URL resolves to a private/internal address.');
    }
  }

  // DNS resolve and check resolved IP
  const addresses = await new Promise<string[]>((resolve, reject) =>
    dns.resolve(hostname, (err, addrs) => {
      if (err) reject(new Error(`Webhook URL DNS resolution failed: ${err.message}`));
      else resolve(addrs);
    }),
  );

  for (const addr of addresses) {
    if (net.isIPv4(addr) && isPrivateIPv4(addr)) {
      throw new Error('Webhook URL resolves to a private/internal address.');
    }
    if (net.isIPv6(addr) && isPrivateIPv6(addr)) {
      throw new Error('Webhook URL resolves to a private/internal address.');
    }
  }
}
