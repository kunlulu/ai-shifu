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

const VIEWING_CONTAINER_SELECTORS = ['.listen-reveal-wrapper', '.listen-reveal'];

const MOBILE_USER_AGENT_PATTERN =
  /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile/i;

const LISTEN_DESKTOP_HORIZONTAL_PADDING = 64;
const LISTEN_DESKTOP_VERTICAL_PADDING = 168;

export interface ViewingContextOptions {
  containerElement?: HTMLElement | null;
  mobileStyle?: boolean;
  isListenMode?: boolean;
}

const normalizeDimension = (value: number) => {
  return Math.max(Math.round(value || 0), 0);
};

const formatSize = (width: number, height: number) => {
  if (!width || !height) {
    return '';
  }

  return `${width}*${height}px`;
};

const getElementDimensions = (element: HTMLElement | null) => {
  if (!element) {
    return null;
  }

  const rect = element.getBoundingClientRect();
  const width = normalizeDimension(
    rect.width || element.clientWidth || element.offsetWidth,
  );
  const height = normalizeDimension(
    rect.height || element.clientHeight || element.offsetHeight,
  );

  if (!width || !height) {
    return null;
  }

  return { width, height };
};

const getContentBoxDimensions = (element: HTMLElement | null) => {
  const dimensions = getElementDimensions(element);

  if (!dimensions || typeof window === 'undefined') {
    return dimensions;
  }

  const computedStyle = window.getComputedStyle(element as Element);
  const width = normalizeDimension(
    dimensions.width -
      (parseFloat(computedStyle.paddingLeft || '0') +
        parseFloat(computedStyle.paddingRight || '0')),
  );
  const height = normalizeDimension(
    dimensions.height -
      (parseFloat(computedStyle.paddingTop || '0') +
        parseFloat(computedStyle.paddingBottom || '0')),
  );

  if (!width || !height) {
    return null;
  }

  return { width, height };
};

const queryElement = (
  selectors: string[],
  containerElement?: HTMLElement | null,
) => {
  if (typeof document === 'undefined') {
    return null;
  }

  const scopes = [containerElement, document].filter(Boolean) as Array<
    HTMLElement | Document
  >;

  for (const scope of scopes) {
    for (const selector of selectors) {
      const element = scope.querySelector(selector) as HTMLElement | null;
      if (element) {
        return element;
      }
    }
  }

  return null;
};

const getSectionSize = (options?: ViewingContextOptions) => {
  const sectionElement = queryElement(
    VIEWING_SECTION_SELECTORS,
    options?.containerElement,
  );
  const dimensions = getElementDimensions(sectionElement);

  if (!dimensions) {
    return '';
  }

  return formatSize(dimensions.width, dimensions.height);
};

const getListenContainerFallbackSize = (options?: ViewingContextOptions) => {
  const containerElement = queryElement(
    VIEWING_CONTAINER_SELECTORS,
    options?.containerElement,
  );
  const dimensions = getContentBoxDimensions(containerElement);

  if (!dimensions) {
    return '';
  }

  return formatSize(dimensions.width, dimensions.height);
};

const getRootContainerFallbackSize = (options?: ViewingContextOptions) => {
  const { containerElement, isListenMode, mobileStyle } = options ?? {};
  const dimensions = getElementDimensions(containerElement ?? null);

  if (!dimensions) {
    return '';
  }

  if (!isListenMode) {
    return formatSize(dimensions.width, dimensions.height);
  }

  const width = mobileStyle
    ? dimensions.width
    : normalizeDimension(
        dimensions.width - LISTEN_DESKTOP_HORIZONTAL_PADDING,
      );
  const height = mobileStyle
    ? dimensions.height
    : normalizeDimension(dimensions.height - LISTEN_DESKTOP_VERTICAL_PADDING);

  return formatSize(width, height);
};

export const getViewingContainerSize = (options?: ViewingContextOptions) => {
  return (
    getSectionSize(options) ||
    getListenContainerFallbackSize(options) ||
    getRootContainerFallbackSize(options)
  );
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

export const getViewingContextPayload = (options?: ViewingContextOptions) => {
  return {
    viewing_container_size: getViewingContainerSize(options),
    viewing_client_type: getViewingClientType(),
  };
};

export { VIEWING_CLIENT_TYPE };
