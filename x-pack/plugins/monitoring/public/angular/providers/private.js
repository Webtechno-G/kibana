/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

/**
 * # `Private()`
 * Private module loader, used to merge angular and require js dependency styles
 * by allowing a require.js module to export a single provider function that will
 * create a value used within an angular application. This provider can declare
 * angular dependencies by listing them as arguments, and can be require additional
 * Private modules.
 *
 * ## Define a private module provider:
 * ```js
 * export default function PingProvider($http) {
 *   this.ping = function () {
 *     return $http.head('/health-check');
 *   };
 * };
 * ```
 *
 * ## Require a private module:
 * ```js
 * export default function ServerHealthProvider(Private, Promise) {
 *   let ping = Private(require('ui/ping'));
 *   return {
 *     check: Promise.method(function () {
 *       let attempts = 0;
 *       return (function attempt() {
 *         attempts += 1;
 *         return ping.ping()
 *         .catch(function (err) {
 *           if (attempts < 3) return attempt();
 *         })
 *       }())
 *       .then(function () {
 *         return true;
 *       })
 *       .catch(function () {
 *         return false;
 *       });
 *     })
 *   }
 * };
 * ```
 *
 * # `Private.stub(provider, newInstance)`
 * `Private.stub()` replaces the instance of a module with another value. This is all we have needed until now.
 *
 * ```js
 * beforeEach(inject(function ($injector, Private) {
 *   Private.stub(
 *     // since this module just exports a function, we need to change
 *     // what Private returns in order to modify it's behavior
 *     require('ui/agg_response/hierarchical/_build_split'),
 *     sinon.stub().returns(fakeSplit)
 *   );
 * }));
 * ```
 *
 * # `Private.swap(oldProvider, newProvider)`
 * This new method does an 1-for-1 swap of module providers, unlike `stub()` which replaces a modules instance.
 * Pass the module you want to swap out, and the one it should be replaced with, then profit.
 *
 * Note: even though this example shows `swap()` being called in a config
 * function, it can be called from anywhere. It is particularly useful
 * in this scenario though.
 *
 * ```js
 * beforeEach(module('kibana', function (PrivateProvider) {
 *   PrivateProvider.swap(
 *     function StubbedRedirectProvider($decorate) {
 *       // $decorate is a function that will instantiate the original module when called
 *       return sinon.spy($decorate());
 *     }
 *   );
 * }));
 * ```
 *
 * @param {[type]} prov [description]
 */
import _ from 'lodash';

const nextId = _.partial(_.uniqueId, 'privateProvider#');

function name(fn) {
  return fn.name || fn.toString().split('\n').shift();
}

export function PrivateProvider() {
  const provider = this;

  // one cache/swaps per Provider
  const cache = {};
  const swaps = {};

  // return the uniq id for this function
  function identify(fn) {
    if (typeof fn !== 'function') {
      throw new TypeError('Expected private module "' + fn + '" to be a function');
    }

    if (fn.$$id) return fn.$$id;
    else return (fn.$$id = nextId());
  }

  provider.stub = function (fn, instance) {
    cache[identify(fn)] = instance;
    return instance;
  };

  provider.swap = function (fn, prov) {
    const id = identify(fn);
    swaps[id] = prov;
  };

  provider.$get = [
    '$injector',
    function PrivateFactory($injector) {
      // prevent circular deps by tracking where we came from
      const privPath = [];
      const pathToString = function () {
        return privPath.map(name).join(' -> ');
      };

      // call a private provider and return the instance it creates
      function instantiate(prov, locals) {
        if (~privPath.indexOf(prov)) {
          throw new Error(
            'Circular reference to "' +
              name(prov) +
              '"' +
              ' found while resolving private deps: ' +
              pathToString()
          );
        }

        privPath.push(prov);

        const context = {};
        let instance = $injector.invoke(prov, context, locals);
        if (!_.isObject(instance)) instance = context;

        privPath.pop();
        return instance;
      }

      // retrieve an instance from cache or create and store on
      function get(id, prov, $delegateId, $delegateProv) {
        if (cache[id]) return cache[id];

        let instance;

        if ($delegateId != null && $delegateProv != null) {
          instance = instantiate(prov, {
            $decorate: _.partial(get, $delegateId, $delegateProv),
          });
        } else {
          instance = instantiate(prov);
        }

        return (cache[id] = instance);
      }

      // main api, get the appropriate instance for a provider
      function Private(prov) {
        let id = identify(prov);
        let $delegateId;
        let $delegateProv;

        if (swaps[id]) {
          $delegateId = id;
          $delegateProv = prov;

          prov = swaps[$delegateId];
          id = identify(prov);
        }

        return get(id, prov, $delegateId, $delegateProv);
      }

      Private.stub = provider.stub;
      Private.swap = provider.swap;

      return Private;
    },
  ];

  return provider;
}
