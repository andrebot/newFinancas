import { describe, expect, it } from 'vitest';
import { describeUserAgent } from '../../../src/utilities/userAgent';

// Utility (BDT: unit, pure — nothing mocked): real headers from each browser
// and system the profile names.

const CHROME_MAC = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
  'AppleWebKit/537.36 (KHTML, like Gecko)',
  'Chrome/129.0.0.0 Safari/537.36',
].join(' ');
const SAFARI_IPHONE = [
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X)',
  'AppleWebKit/605.1.15 (KHTML, like Gecko)',
  'Version/17.6 Mobile/15E148 Safari/604.1',
].join(' ');
const FIREFOX_WINDOWS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0)',
  'Gecko/20100101 Firefox/131.0',
].join(' ');
const EDGE_WINDOWS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
  'AppleWebKit/537.36 (KHTML, like Gecko)',
  'Chrome/129.0.0.0 Safari/537.36 Edg/129.0.0.0',
].join(' ');
const OPERA_LINUX = [
  'Mozilla/5.0 (X11; Linux x86_64)',
  'AppleWebKit/537.36 (KHTML, like Gecko)',
  'Chrome/129.0.0.0 Safari/537.36 OPR/114.0.0.0',
].join(' ');
const SAMSUNG_PHONE = [
  'Mozilla/5.0 (Linux; Android 14; SM-S921B)',
  'AppleWebKit/537.36 (KHTML, like Gecko)',
  'SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36',
].join(' ');
const CHROME_ANDROID_TABLET = [
  'Mozilla/5.0 (Linux; Android 14; SM-X710)',
  'AppleWebKit/537.36 (KHTML, like Gecko)',
  'Chrome/129.0.0.0 Safari/537.36',
].join(' ');
const SAFARI_IPAD = [
  'Mozilla/5.0 (iPad; CPU OS 17_6 like Mac OS X)',
  'AppleWebKit/605.1.15 (KHTML, like Gecko)',
  'Version/17.6 Mobile/15E148 Safari/604.1',
].join(' ');
const CHROME_IOS = [
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X)',
  'AppleWebKit/605.1.15 (KHTML, like Gecko)',
  'CriOS/129.0.6668.69 Mobile/15E148 Safari/604.1',
].join(' ');
const CHROMEBOOK = [
  'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0)',
  'AppleWebKit/537.36 (KHTML, like Gecko)',
  'Chrome/129.0.0.0 Safari/537.36',
].join(' ');

describe('describeUserAgent', () => {
  it.each([
    [CHROME_MAC, 'Chrome', 'macOS', 'laptop'],
    [SAFARI_IPHONE, 'Safari', 'iOS', 'phone'],
    [FIREFOX_WINDOWS, 'Firefox', 'Windows', 'desktop'],
    [EDGE_WINDOWS, 'Edge', 'Windows', 'desktop'],
    [OPERA_LINUX, 'Opera', 'Linux', 'desktop'],
    [SAMSUNG_PHONE, 'Samsung Internet', 'Android', 'phone'],
    [CHROME_ANDROID_TABLET, 'Chrome', 'Android', 'tablet'],
    [SAFARI_IPAD, 'Safari', 'iPadOS', 'tablet'],
    [CHROME_IOS, 'Chrome', 'iOS', 'phone'],
    [CHROMEBOOK, 'Chrome', 'ChromeOS', 'desktop'],
  ])('reads %s', (userAgent, browser, system, kind) => {
    expect(describeUserAgent(userAgent)).toEqual({ browser, system, kind });
  });

  it('knows nothing of a device that sent no header', () => {
    expect(describeUserAgent(null)).toEqual({ kind: 'unknown' });
    expect(describeUserAgent('')).toEqual({ kind: 'unknown' });
  });

  it('keeps what it recognises of an unusual header', () => {
    expect(describeUserAgent('curl/8.5.0')).toEqual({
      browser: undefined, system: undefined, kind: 'unknown',
    });
    expect(describeUserAgent('Mozilla/5.0 (Windows NT 10.0) SomeBot/1.0')).toEqual({
      browser: undefined, system: 'Windows', kind: 'desktop',
    });
  });
});
