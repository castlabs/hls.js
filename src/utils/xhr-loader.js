/**
 * XHR based logger
*/

import {logger} from '../utils/logger';

class XhrLoader {

  constructor(config) {
    if (config && config.xhrSetup) {
      this.xhrSetup = config.xhrSetup;
    }
  }

  destroy() {
    this.abort();
    this.loader = null;
  }

  abort() {
    var loader = this.loader;
    if (loader && loader.readyState !== 4) {
      this.stats.aborted = true;
      loader.abort();
    }

    window.clearTimeout(this.requestTimeout);
    this.requestTimeout = null;
    window.clearTimeout(this.retryTimeout);
    this.retryTimeout = null;
  }

  load(context, config, callbacks) {
    this.context = context;
    this.config = config;
    this.callbacks = callbacks;
    this.stats = {trequest: performance.now(), retry: 0};
    this.retryDelay = config.retryDelay;
    this.loadInternal();
  }

  loadInternal() {
    var xhr, context = this.context;
    xhr = this.loader = new XMLHttpRequest();

    let stats = this.stats;
    stats.tfirst = 0;
    stats.loaded = 0;
    const xhrSetup = this.xhrSetup;

    const mutableContext = {
      xhr: xhr,
      method: 'GET',
      uris: [context.url],
      headers: {},
      allowCrossSiteCredentials: false,
      body: undefined
    };

    if (context.rangeEnd) {
      /*jshint -W069 */
      mutableContext.headers['Range'] = 'bytes=' + context.rangeStart + '-' + (context.rangeEnd - 1);
      /*jshint +W069 */
    }

    try {
      if (xhrSetup) {
        xhrSetup(mutableContext);
      }

      xhr.open(mutableContext.method, mutableContext.uris[0], true);
    } catch (e) {
      // IE11 throws an exception on xhr.open if attempting to access an HTTP resource over HTTPS
      this.callbacks.onError({ code : xhr.status, text: e.message }, context, xhr);
      return;
    }

    Object.keys(mutableContext.headers).forEach(function(name) {
      var value = mutableContext.headers[name];
      xhr.setRequestHeader(name, value);
    });

    xhr.allowCrossSiteCredentials = mutableContext.allowCrossSiteCredentials;

    xhr.responseType = context.responseType;

    xhr.onreadystatechange = this.readystatechange.bind(this);
    xhr.onprogress = this.loadprogress.bind(this);

    // setup timeout before we perform request
    this.requestTimeout = window.setTimeout(this.loadtimeout.bind(this), this.config.timeout);
    xhr.send(mutableContext.body);
  }

  readystatechange(event) {
    var xhr = event.currentTarget,
        readyState = xhr.readyState,
        stats = this.stats,
        context = this.context,
        config = this.config;

    // don't proceed if xhr has been aborted
    if (stats.aborted) {
      return;
    }

    // >= HEADERS_RECEIVED
    if (readyState >=2) {
      // clear xhr timeout and rearm it if readyState less than 4
      window.clearTimeout(this.requestTimeout);
      if (stats.tfirst === 0) {
        stats.tfirst = Math.max(performance.now(), stats.trequest);
      }
      if (readyState === 4) {
        let status = xhr.status;
        // http status between 200 to 299 are all successful
        if (status >= 200 && status < 300)  {
          stats.tload = Math.max(stats.tfirst,performance.now());
          let data,len;
          if (context.responseType === 'arraybuffer') {
            data = xhr.response;
            len = data.byteLength;
          } else {
            data = xhr.responseText;
            len = data.length;
          }
          stats.loaded = stats.total = len;
          let response = { url : xhr.responseURL, data : data };
          this.callbacks.onSuccess(response, stats, context, xhr);
        } else {
            // if max nb of retries reached or if http status between 400 and 499 (such error cannot be recovered, retrying is useless), return error
          if (stats.retry >= config.maxRetry || (status >= 400 && status < 499)) {
            logger.error(`${status} while loading ${context.url}` );
            this.callbacks.onError({ code : status, text : xhr.statusText}, context, xhr);
          } else {
            // retry
            logger.warn(`${status} while loading ${context.url}, retrying in ${this.retryDelay}...`);
            // aborts and resets internal state
            this.destroy();
            // schedule retry
            this.retryTimeout = window.setTimeout(this.loadInternal.bind(this), this.retryDelay);
            // set exponential backoff
            this.retryDelay = Math.min(2 * this.retryDelay, config.maxRetryDelay);
            stats.retry++;
          }
        }
      } else {
        // readyState >= 2 AND readyState !==4 (readyState = HEADERS_RECEIVED || LOADING) rearm timeout as xhr not finished yet
        this.requestTimeout = window.setTimeout(this.loadtimeout.bind(this), config.timeout);
      }
    }
  }

  loadtimeout() {
    logger.warn(`timeout while loading ${this.context.url}` );
    this.callbacks.onTimeout(this.stats, this.context, null);
  }

  loadprogress(event) {
    var xhr = event.currentTarget,
        stats = this.stats;

    stats.loaded = event.loaded;
    if (event.lengthComputable) {
      stats.total = event.total;
    }
    let onProgress = this.callbacks.onProgress;
    if (onProgress) {
      // third arg is to provide on progress data
      onProgress(stats, this.context, null, xhr);
    }
  }
}

export default XhrLoader;
