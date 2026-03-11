const VIEWING_CLIENT_TYPE = {
  MOBILE: '移动端',
  DESKTOP: '电脑端',
} as const;

const VIEWING_SECTION_SELECTORS = [
  '.listen-reveal .slides section.present',
  '.reveal .slides section.present',
  '.listen-reveal .slides section',
  '.reveal .slides section',
  '.slides section.present',
  '.slides section',
];

const MOBILE_USER_AGENT_PATTERN =
  /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile/i;

const normalizeDimension = (value: number) => {
  return Math.max(Math.round(value || 0), 0);
};

const getViewingSectionElement = () => {
  if (typeof document === 'undefined') {
    return null;
  }

  return VIEWING_SECTION_SELECTORS.reduce<HTMLElement | null>((matched, selector) => {
    if (matched) {
      return matched;
    }

    return document.querySelector(selector) as HTMLElement | null;
  }, null);
};

export const getViewingContainerSize = () => {
  const sectionElement = getViewingSectionElement();

  if (!sectionElement) {
    return '';
  }

  const rect = sectionElement.getBoundingClientRect();
  const width = normalizeDimension(
    rect.width || sectionElement.clientWidth || sectionElement.offsetWidth,
  );
  const height = normalizeDimension(
    rect.height || sectionElement.clientHeight || sectionElement.offsetHeight,
  );

  if (!width || !height) {
    return '';
  }

  // Match the expected payload format like 100*200px.
  return `${width}*${height}px`;
};

export const getViewingClientType = () => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return VIEWING_CLIENT_TYPE.DESKTOP;
  }

  const userAgent = navigator.userAgent || '';
  const matchesTouchScreen =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(pointer: coarse)').matches &&
    window.matchMedia('(max-width: 1024px)').matches;

  return MOBILE_USER_AGENT_PATTERN.test(userAgent) || matchesTouchScreen
    ? VIEWING_CLIENT_TYPE.MOBILE
    : VIEWING_CLIENT_TYPE.DESKTOP;
};

export const getViewingContextPayload = () => {
  return {
    viewing_container_size: getViewingContainerSize(),
    viewing_client_type: getViewingClientType(),
  };
};

export { VIEWING_CLIENT_TYPE };
