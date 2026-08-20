import { describe, expect, it } from 'vitest';
import { supportedYoutubeTracks, youtubeTrackLanguage } from '../youtubeTracks';

describe('YouTube subtitle language filtering', () => {
  it('keeps only Chinese, Japanese, English, and German', () => {
    const tracks = supportedYoutubeTracks({
      title: 'Video',
      thumbnail: null,
      duration: 10,
      manual: [],
      automatic: [
        { lang: 'fi', is_auto: true },
        { lang: 'zh-Hans', is_auto: true },
        { lang: 'ja', is_auto: true },
        { lang: 'en', is_auto: true },
        { lang: 'de', is_auto: true },
      ],
    });

    expect(tracks.map((item) => item.language)).toEqual(['zh', 'ja', 'en', 'de']);
  });

  it('prefers manual captions and original automatic captions', () => {
    const tracks = supportedYoutubeTracks({
      title: 'Video',
      thumbnail: null,
      duration: null,
      manual: [{ lang: 'ja', is_auto: false }],
      automatic: [
        { lang: 'ja-orig', is_auto: true },
        { lang: 'ja', is_auto: true },
        { lang: 'en', is_auto: true },
        { lang: 'en-orig', is_auto: true },
      ],
    });

    expect(tracks.find((item) => item.language === 'ja')?.track).toEqual({ lang: 'ja', is_auto: false });
    expect(tracks.find((item) => item.language === 'en')?.track.lang).toBe('en-orig');
  });

  it('normalizes supported language variants', () => {
    expect(youtubeTrackLanguage('zh-Hant')).toBe('zh');
    expect(youtubeTrackLanguage('en-US')).toBe('en');
    expect(youtubeTrackLanguage('fi')).toBeNull();
  });
});

