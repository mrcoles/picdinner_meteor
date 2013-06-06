//     Backbone.PushStateRouter 0.0.1

//     (c) 2013 Peter Coles, http://mrcoles.com
//     This may be freely distributed under the MIT license.

(function(Backbone, _) {

    // Backbone.PushStateRouter
    // ------------------------
    //
    // A simplified way to set up a
    // [Backbone Router](http://backbonejs.org/#Router) that uses
    // HTML5 pushstate only and automatically works for any links in
    // your application except any links that specify a `data-bypass`
    // attribute. Note - you can only setup one PushStateRouter
    // per application.
    //
    // Dependencies: backbone.js, underscore.js, jquery.js
    //
    Backbone.PushStateRouter = _.extend(function(routes, fns, historyOptions) {
        // `routes` should match the format of the Backbone
        // [router.routes](http://backbonejs.org/#Router-routes).
        // However, you can map routes to function names or
        // inline functions (a route name is auto-generated in this case).
        //
        // `fns` is an object for mapping any route names to functions, e,g,:
        //
        //     Backbone.PushStateRouter({
        //         "test": function() { alert('this is the test route'); },
        //         "post/:id": "getPost"
        //     }, {
        //         getPost: function(id) { alert('getting post ' + id); }
        //     })
        //
        routes = _.extend({}, routes);
        fns = _.extend({}, fns);

        // `historyOptions` are any values that you would pass to the
        // [Backbone.history.start](http://backbonejs.org/#History-start)
        // method. NOTE: you cannot override the pushState or hashChange
        // options from: `{pushState: true, hashChange: false}`
        historyOptions = _.extend({}, historyOptions,
                                  {pushState: true, hashChange: false});

        var counter = 0;

        _.each(routes, function(value, key) {
            if (_.isFunction(value)) {
                var t = "route" + (counter++);
                fns[t] = value;
                routes[key] = t;
            }
        });

        var Router = Backbone.Router.extend({
            routes: routes,
            initialize: function() {
                var router = this;

                // Make all link clicks go through the router, unless
                // they have a `data-bypass` attribute or don't match
                // a route.
                $(document).on('click', 'a:not([data-bypass])', function (evt) {
                    var $this = $(this),
                        href = $this.prop('href'), // look at the full URL
                        hrefAttr = $this.attr('href'),
                        baseUrl = window.location.href
                        .split('/')
                        .slice(0,3)
                        .join('/') + '/';

                    // let links with a target pass through...
                    if ($this.attr('target')) {
                        return;
                    }

                    // Verify that we are still on the same domain and protocol
                    // and that it's not a hash link.
                    if (href.indexOf(baseUrl) == 0 && hrefAttr.indexOf('#') != 0) {
                        href = href.slice(baseUrl.length - 1);

                        // Get the fragment for the `loadUrl` call
                        // (technically redundant for `router.navigate`).
                        var fragment = Backbone.history.getFragment(href);

                        // Navigate to the proper page, don't trigger loadUrl.
                        router.navigate(fragment, false);

                        // Manually call loadUrl and if it suceeded in finding
                        // a route, then preventDefault.
                        //
                        // Note: if we wanted to prevent this from getting
                        // called when the URL hasn't changed, we'd have to
                        // check `Backbone.history.fragment === fragment`,
                        // but browsers trigger a reload when you click on
                        // a link to the same page - so this is consistent.
                        if (Backbone.history.loadUrl(fragment)) {
                            evt.preventDefault();
                        }
                    }
                });
            }
        });

        var router = new Router;

        _.each(fns, function(fn, key) {
            router.on("route:" + key, fn);
        });

        Backbone.history.start(historyOptions);

        return router;
    }, {
        VERSION: '0.0.1'
    });
})(Backbone, _);
