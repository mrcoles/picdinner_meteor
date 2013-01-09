// Peter Coles - mrcoles.com - 2013

if (Meteor.isClient) {
    Meteor.startup(function() {
        var head = document.getElementsByTagName('head')[0];

        // twitter
        var js = document.createElement('script');
        js.id = 'twitter-wjs';
        js.src = '//platform.twitter.com/widgets.js';
        head.appendChild(js);

        // facebook
        js = document.createElement('script');
        js.id = 'facebook-jssdk';
        js.src = ('//connect.facebook.net/en_US/all.js' +
                  '#xfbml=1&appId=163098883714272');
        head.appendChild(js);
    });

    var SharesLoader = (function() {
        var _timeouts = {};

        function cancelWidgets() {
            _.each(_timeouts, function(val, key) {
                Meteor.clearTimeout(val);
            });
            _timeouts = {};
        }

        var loaders = [
            function() {
                Meteor.clearTimeout(_timeouts['twitter']);
                if (window.twttr && twttr.widgets && twttr.widgets.load) {
                    twttr.widgets.load();
                } else {
                    _timeouts['twitter'] = Meteor.setTimeout(loadWidgets, 20);
                }
            },
            function() {
                Meteor.clearTimeout(_timeouts['fb']);
                if (window.FB && FB.XFBML && FB.XFBML.parse) {
                    if ($('.fb-like').map(function(i,x) {
                        return $(x).find('iframe').size() ? null : 1;
                    }).size()) {
                        FB.XFBML.parse();
                    }
                } else {
                    _timeouts['fb'] = Meteor.setTimeout(loadWidgets, 20);
                }
            }
        ];

        function loadWidgets() {
            _.each(loaders, function(fn) { fn(); });
        }

        return {
            load: loadWidgets,
            cancel: cancelWidgets
        };
    })();
}
