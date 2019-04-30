export function getSelfScope () {
    // see https://stackoverflow.com/a/11237259/589493
    if (typeof window === 'undefined') {
      /* jshint ignore:start */
      /* eslint-disable-next-line no-undef */
      return self;
      /* jshint ignore:end */
    } else {
      return window;
    }
}
