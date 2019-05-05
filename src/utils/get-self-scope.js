export function getSelfScope () {
    // see https://stackoverflow.com/a/11237259/589493
    if (typeof window === 'undefined') {
      /* jshint ignore:start */
      /* eslint-disable-next-line no-undef */
      if (typeof self !== 'undefined') {
        return self;
      } else {
        // NOTE: mock console for internal hls.js tests
        return {
          console: {}
        };
      }
      /* jshint ignore:end */
    } else {
      return window;
    }
}
