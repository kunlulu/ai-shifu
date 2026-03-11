import {
  VIEWING_CLIENT_TYPE,
  getViewingClientType,
  getViewingContainerSize,
  getViewingContextPayload,
} from '@/c-utils/viewing-context';

describe('viewing-context', () => {
  const originalUserAgent = window.navigator.userAgent;
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    document.body.innerHTML = '';
    Object.defineProperty(window.navigator, 'userAgent', {
      configurable: true,
      value: originalUserAgent,
    });
    window.matchMedia = jest.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }));
  });

  afterAll(() => {
    Object.defineProperty(window.navigator, 'userAgent', {
      configurable: true,
      value: originalUserAgent,
    });
    window.matchMedia = originalMatchMedia;
  });

  it('returns section size using present slide dimensions', () => {
    document.body.innerHTML = `
      <div class="listen-reveal">
        <div class="slides">
          <section class="present"></section>
        </div>
      </div>
    `;

    const section = document.querySelector('section.present') as HTMLElement;
    Object.defineProperty(section, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({
        width: 100,
        height: 200,
        top: 0,
        left: 0,
        right: 100,
        bottom: 200,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }),
    });

    expect(getViewingContainerSize()).toBe('100*200px');
  });

  it('falls back to chat container size before slides render', () => {
    const container = document.createElement('div');
    Object.defineProperty(container, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({
        width: 390,
        height: 844,
        top: 0,
        left: 0,
        right: 390,
        bottom: 844,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }),
    });

    expect(
      getViewingContainerSize({
        containerElement: container,
        mobileStyle: true,
        isListenMode: true,
      }),
    ).toBe('390*844px');
  });

  it('returns mobile client type for mobile user agents', () => {
    Object.defineProperty(window.navigator, 'userAgent', {
      configurable: true,
      value:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
    });

    expect(getViewingClientType()).toBe(VIEWING_CLIENT_TYPE.MOBILE);
  });

  it('returns desktop client type by default', () => {
    Object.defineProperty(window.navigator, 'userAgent', {
      configurable: true,
      value:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    });

    expect(getViewingClientType()).toBe(VIEWING_CLIENT_TYPE.DESKTOP);
  });

  it('builds the viewing payload with both fields', () => {
    document.body.innerHTML = `
      <div class="reveal">
        <div class="slides">
          <section class="present"></section>
        </div>
      </div>
    `;

    const section = document.querySelector('section.present') as HTMLElement;
    Object.defineProperty(section, 'clientWidth', {
      configurable: true,
      value: 320,
    });
    Object.defineProperty(section, 'clientHeight', {
      configurable: true,
      value: 180,
    });

    expect(getViewingContextPayload()).toEqual({
      viewing_container_size: '320*180px',
      viewing_client_type: VIEWING_CLIENT_TYPE.DESKTOP,
    });
  });
});
