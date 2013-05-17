
// TODO
//
// *   sort by "top" + voting
// *   remixing of an existing picdinner
// *   simple gif search - maybe just scrape http://www.reddit.com/r/woahdude.json & http://www.reddit.com/r/gifs.json?
// *   simple soundcloud search
// *   embed script to put on other pages
//

Pairs = new Meteor.Collection('pairs');

Pairs.allow({
    insert: function(userId, doc) {
        if (doc.userId && doc.userId != userId) {
            return false;
        }
        if (doc.start && (typeof doc.start !== 'number' ||
                          isNaN(doc.start))) {
            return false;
        }
        return true;
    },
    update: function(userId, doc, fields, modifier) {
        if (_.contains(fields, 'userId')) {
            return false;
        }
        return false;
    },
    remove: function(userId, doc) {
        if (!userId || !doc.userId) return false;
        return userId == doc.userId;
    }
});

function createdNow() {
    return (new Date()).getTime();
}

function lookupNext(currentCreated, prev, asFind) {
    if (!currentCreated) return null;
    return Pairs[asFind ? 'find' : 'findOne']({
        created: prev ? {'$gt': currentCreated} : {'$lt': currentCreated}
    }, {
        sort: {'created': prev ? 1 : -1},
        limit: 1
    });
}

if (Meteor.isClient) {

    function getBackUrl() {
        return (sortTypeRoutes[Session.get('sortType')] ||
                sortTypeRoutes.newest)();
    }

    function log() {
        try {
            console.log.apply(console, arguments);
        } catch(e) {}
    }

    var renderLogDebug = false;
    function renderLog() {
        if (!renderLogDebug) return;
        try {
            console.log.apply(console, arguments);
        } catch(e) {}
    }

    function setIfNotEqual(attr, val) {
        if (!Session.equals(attr, val)) {
            Session.set(attr, val);
        }
    }


    // seeks the audio in the soundcloud widget a certain number of seconds
    function seekWidget(seconds) {
        var self = seekWidget,
            playCounter = self.playCounter;

        function playIt(volume) {
            scWidget.setVolume(volume === undefined ? 100 : volume);
            scWidget.play();
        }

        if (!seconds) {
            playIt();
            return;
        }

        var time = Math.round(seconds * 1000);
        playIt(0);

        scWidget.getDuration(function(duration) {
            if (time >= duration) {
                playIt();
            }

            (function doSeek() {
                scWidget.seekTo(time);
                // this basically waits for the widget to load the sound, continually
                // seeking to the furthest loaded point until the target is reached
                scWidget.getPosition(function(position) {
                    if (self.playCounter == playCounter) {
                        if (position >= time) {
                            playIt();
                        } else {
                            seekWidget.timeout = Meteor.setTimeout(doSeek, 200);
                        }
                    }
                });
            })();
        });
    }
    _.extend(seekWidget, {
        playCounter: 0,
        stop: function() {
            var self = seekWidget;
            Meteor.clearTimeout(self.timeout);
            self.playCounter++;
        }
    });


    // auto update pair subscription when it changes
    Deps.autorun(function() {
        var curPairId = Session.get('currentPairId'),
            curCreated = Session.get('currentCreated'),
            lastCreated = Session.get('lastCreated'),
            sortType = Session.get('sortType'),
            viewUserId = Session.get('viewUserId');
        renderLog('[SUBSCRIBE.PAIRS]', lastCreated, sortType, viewUserId, curPairId, curCreated);
        Meteor.subscribe('pairs', curPairId, lastCreated, sortType, viewUserId);
        Meteor.subscribe('pair', curPairId);
        Meteor.subscribe('prevPair', curCreated, sortType, viewUserId);
        Meteor.subscribe('nextPair', curCreated, sortType, viewUserId);
    });

    //
    // Options
    //
    Template.options.sortType = function() {
        return Session.get('sortType');
    };

    _.each(['newest', 'top', 'user'], function(x) {
        Template.options[x] = function() {
            return Session.get('sortType') == x ? 'strong' : '';
        };
    });

    //
    // Add Pair
    //
    Template.addPair.formNoImage = function() {
        return Session.get('formNoImage');
    };

    Template.addPair.errorMessage = function() {
        return Session.get('formErrorMessage');
    };

    // used to hide modal without changing url
    var skipSettingUrl = false;

    Template.addPair.events({
        'submit form': function(e) {
            e.preventDefault();

            var $form = $(e.target),
                $image = $form.find('input[name=image]'),
                $audio = $form.find('input[name=audio]'),
                $startTime = $form.find('input[name=startTime]'),
                image = $image.val(),
                audio = $audio.val(),
                startTime = parseFloat($startTime.val());

            if ($form.hasClass('loading')) {
                return;
            }
            $form.addClass('loading');

            if (!audio) { audio = 'song.mp3'; }

            if (isNaN(startTime) || startTime < 0) { startTime = 0; }

            if (!image) {
                Session.set('formNoImage', true);
                //TODO - maybe this should be part of allow/deny instead?
                return;
            }

            var _rImgur = /^https?:\/\/([^\/]*\.)?imgur.com/i,
                _rSuffix = /\.[^\/]+$/i;

            if (_rImgur.test(image) && !_rSuffix.test(image)) {
                var t = image.split('/').pop();
                image = 'http://i.imgur.com/' + t + '.gif';
            }

            var data = {
                image: image,
                audio: audio,
                created: createdNow(),
                startTime: startTime
            };

            if (Meteor.userId()) {
                data.userId = Meteor.userId();
            }

            var id = Pairs.insert(data, function(error, _id) {
                if (error) {
                    log('[SAVE ERROR]', error);
                    Session.set('formErrorMessage', 'There was an error saving this :\'(');
                    $form.removeClass('loading');
                } else {
                    recents.add(_id);
                    $form.find('input').val('');
                    Session.set('formErrorMessage', null);
                    Session.set('formNoImage', false);
                    Session.set('currentPairId', _id);

                    Backbone.history.navigate('/'+_id);

                    skipSettingUrl = true;
                    $('#add-pair').modal('hide');
                    $form.removeClass('loading');
                }
            });
        },
        'change input, keyup input': function() {
            Session.set('formErrorMessage', null);
            Session.set('formNoImage', false);
        }
    });

    Meteor.startup(function() {
        // other options: hidden, show, shown
        $('#add-pair').on('hide', function(e, skipHistory) {
            if (!skipSettingUrl) {
                Backbone.history.navigate(getBackUrl(), true);
            }
            skipSettingUrl = false;
        });
    });

    //
    // Pairs
    //
    var Paginator = (function() {
        // pretty jenky first attempt at pagination
        // -  things flicker when you click next
        // -  not sure how to check if there are no pairs in the template
        // -  stores state in js
        var self = {
            lastCreatedStack: [],
            addNewest: function() {
                var lastCreated = $('#pairs').find('.pair').last().data('created');
                if (!lastCreated) {
                    self.lastCreatedStack = [];
                } else {
                    self.lastCreatedStack.push(Session.get('lastCreated'));
                }
                Session.set('lastCreated', lastCreated);
                self._updateState();
                window.scrollTo(0, 0);
            },
            popNewest: function() {
                var lastCreated = self.lastCreatedStack.pop() || null;
                Session.set('lastCreated', lastCreated);
                self._updateState();
                window.scrollTo(0, 0);
            },
            _updateState: function() {
                setIfNotEqual('hasPrev', self.lastCreatedStack.length != 0);
                setIfNotEqual('hasNext',
                              (self.lastCreatedStack.length == 0 ||
                               $('#pairs').find('.pair').size() != 0));
            }
        };
        self._updateState();
        return self;
    })();

    Template.pairs.hasPrev = function() { return Session.get('hasPrev'); };
    Template.pairs.hasNext = function() { return Session.get('hasNext'); };

    Template.pairs.pairs = function() {
        var query = {},
            lastCreated = Session.get('lastCreated');
        if (lastCreated) {
            query.created = {'$lt': lastCreated};
        }
        var pairs = Pairs.find(query, {sort: {"created": -1}}).fetch();
        renderLog('[PAIRS]', pairs.length);
        return pairs.map(function(pair) {
            pair.thumb = thumbnailer(pair.image);
            return pair;
        });
    };

    Template.pairs.events({
        'click .next': Paginator.addNewest,
        'click .prev': Paginator.popNewest
    });

    Template.pairs.rendered = function() {
        var colors = 'fdd dfd ddf ffd fdf dff'.split(' '),
            $pairs = $('#pairs'),
            i = 0,
            len = colors.length;
        function bgFn() {
            if (i >= len) i = 0;
            return '#' + colors[i++];
        }
        $pairs.find('a.pair>img').stopgifs({
            parentClosest: '.pair',
            background: bgFn
        });
    };

    //
    // Shares Base
    //
    Template.sharesPrimary.shareUrls = function() {
        //TODO - not have to do the stupid list as a hack
        //       to use parent templates, e.g., sharesPrimary
        return [{shareUrl: 'http://picdinner.com', noFb: false}];
    };

    Template.sharesSecondary.shareUrls = function() {
        var id = Session.get('currentPairId');
        return id ? [{shareUrl: 'http://picdinner.com/'+id, noFb: false}] : [];
    };

    //
    // View Pair
    //
    var scWidget = null;
    var viewer = {
        active: false,
        pairId: null,
        audio: null,
        update: function(pairId, pair) {

            if (pairId || pair) {
                $('body').addClass('in-viewer');
            }

            // open
            if (pair) {
                var isSoundCloud = this.isSoundCloud(pair.audio);
                var $viewImage = $('#view-image');
                $('html')[isSoundCloud ? 'addClass' : 'removeClass']('is-soundcloud');

                if (!this.pairId || this.pairId != pairId) {
                    this.clear();
                    var au = isSoundCloud ? null :
                        $.extend(new Audio(), {
                            //loop: true, - manage loop in `ended`
                            autoplay: AUTOPLAY
                        });
                    if (au) {
                        $('html').addClass('show-arrows');

                        $(au).on('play', function(e) {
                            log('[AU.PLAY]', e);
                            Session.set('showMobilePlay', false);
                        }).on('playing', function(e) {
                            log('[AU.PLAYING]', e);
                        }).on('ended', function(e) {
                            log('[AU.ENDED]', e);
                            if (!tryNext()) {
                                au.play();
                            }
                        });

                        // cross browser support ogg vs mp3
                        var src = pair.audio;
                        if (au.canPlayType('audio/ogg')) {
                            var sp = src.split('.');
                            sp.pop();
                            sp.push('ogg');
                            src = sp.join('.');
                        }

                        au.src =  src;
                    }
                    this.audio = au;
                    this.pairId = pairId;

                    if (!AUTOPLAY) {
                        Session.set('showMobilePlay', !isSoundCloud);
                    }

                    if (isSoundCloud) {
                        $viewImage.fadeOut(0);
                        scWidget.load(pair.audio, {
                            callback: function() {
                                log('[SC.CALLBACK]');
                                viewer.fadeInWidget();

                                if (!AUTOPLAY) {
                                    $('body').addClass('paused-sc');
                                    $viewImage.fadeIn();
                                    return;
                                }

                                // HACK wait a moment before play
                                Meteor.setTimeout(function() {
                                    if (viewer.pairId != pairId) {
                                        return;
                                    }

                                    var startTime = 0;
                                    if (pair.startTime) {
                                        startTime = pair.startTime;
                                    }
                                    seekWidget(startTime);
                                    $viewImage.fadeIn();

                                    // HACK sometimes soundcloud fails to start
                                    Meteor.setTimeout(function() {
                                        scWidget.isPaused(function(paused) {
                                            if (paused &&
                                                viewer.pairId == pairId) {
                                                log('  still paused, hitting play again.');
                                                seekWidget(startTime);
                                            }
                                        });
                                    }, 500);
                                }, 2000);
                            }
                        });
                    }

                    this.active = true;

                    if (!this.didFirstUpdate) {
                        // animate head
                        var $h = $('#head').addClass('trans');
                        Meteor.setTimeout(function() {
                            $h.addClass('go');
                            Meteor.setTimeout(function() {
                                $h.removeClass('trans').removeClass('go');
                            }, 2000);
                        }, 500);
                    }
                }

                var arg = isSoundCloud ? {marginBottom: 166} : {};
                $viewImage.expandImage(arg);

                this.didFirstUpdate = true;

            // close
            } else if (!pairId) {
                this.clear();

                // change back to root URL, unless we're already there
                // or already not active (e.g., load /add)
                if (this.active) {
                    Backbone.history.navigate(getBackUrl(), true);
                }

                this.active = false;
                this.didFirstUpdate = true;
            }
        },
        clear: function() {
            $('body').removeClass('paused-sc').removeClass('in-viewer');
            $('html').removeClass('show-arrows');

            if (this.pairId) {
                this.pairId = null;
                if (this.audio) {
                    this.audio.pause();
                    this.audio = null;
                }
                scWidget.pause();
                viewer.fadeInWidget(false);
                $('#view-image').expandImage('clear');
                Session.set('showMobilePlay', false);
            }
        },
        fadeInWidget: function(fadeIn) {
            if (fadeIn === undefined || fadeIn) {
                $('#widget').fadeIn(1000);
                $('html').addClass('show-arrows');
            } else {
                $('#widget').hide();
                $('html').removeClass('show-arrows');
            }
        },
        toggleAudio: function() {
            if (this.audio) {
                this.audio[this.audio.paused ? 'play' : 'pause']();
            } else {
                scWidget.toggle();
            }
        },
        playAudio: function() {
            if (this.audio) {
                this.audio.play();
                Session.set('showMobilePlay', false);
            } else {
                scWidget.play();
            }
            $('body').removeClass('paused-sc');
        },
        isSoundCloud: function(audio) {
            return audio && /^https?:\/\/soundcloud.com\/.+/i.test(audio);
        }
    };

    Template.viewPair.pair = function() {
        var p = Pairs.findOne({'_id': Session.get('currentPairId')});
        Session.set('currentCreated', p ? p.created : null);
        return p;
    };

    Template.viewPair.prevPair = function() {
        var currentCreated = Session.get('currentCreated');
        return lookupNext(currentCreated, true);
    };

    Template.viewPair.nextPair = function() {
        var currentCreated = Session.get('currentCreated');
        return lookupNext(currentCreated, false);
    };

    Template.viewPair.isSoundCloud = function(audio) {
        return viewer.isSoundCloud(audio);
    };

    Template.viewPair.isTouch = function() {
        return $('html').hasClass('touch');
    };

    Template.viewPair.backUrl = getBackUrl;

    Template.viewPair.mobileClick = function() {
        return !AUTOPLAY && Session.get('currentPairId') &&
            Session.get('showMobilePlay');
    };

    Template.viewPair.rendered = function() {
        var currentPairId = Session.get('currentPairId');
        viewer.update(currentPairId, Template.viewPair.pair());
        SharesLoader.load();
        $('#fader')[currentPairId ? 'addClass' : 'removeClass']('out');
    };

    Template.viewPair.events({
        'click': function(e) {
            if (e.target.id == 'view-pair') {
                Session.set('currentPairId', null);
            }
        },
        'click a#mobile-play': function(e) {
            e.preventDefault();
            viewer.playAudio();
            $('#mobile-play').addClass('clicked');
        }
    });

    // get the x position of the most recent touch event
    // or fallback to this one
    function getX(event) {
        try {
            return event.touches[0].pageX;
        } catch(e) {
            return event.pageX;
        }
    }

    var startX = null,
        moveX = null;

    Template.viewPair.events({
        'touchstart #view-pair, touchmove #view-pair, touchend #view-pair': function(e) {
            if (!$(e.target).closest('#pair-info').size()) {
                // only stop touch events that aren't hitting
                // useful things
                e.preventDefault();
            }

            var $img = $('#view-image');

            if ('touchstart' == e.type) {
                startX = getX(e);
            } else if ('touchmove' == e.type) {
                moveX = getX(e);
                var dx = (moveX - startX) * 1.6;
                if (hasArrow(dx > 0)) {
                    $img.css('left', dx+'px');
                }
            } else if ('touchend' == e.type) {
                if (moveX != null) {
                    var diff = moveX - startX;
                    if (Math.abs(diff) >= window.innerWidth / 4) {
                        if (tryArrow(diff > 0)) {
                            $img.hide();
                        }
                    }
                }
                $img.css('left', 0);
                startX = moveX = null;
            }
        }
    });

    Meteor.startup(function() {

        $(window).on('keyup', function(e) {
            if (viewer.active) {
                if (e.which == 27) {
                    Session.set('currentPairId', null);
                } else if (e.which == 32) {
                    viewer.toggleAudio();
                }
            }
        });

        // // initialize soundcloud client
        // SC.initialize({
        //     client_id: 'f6ea539c4f3ba2383cacb0b3e1926f11'
        // });
    });


    //
    // URL Routing
    //
    var sortTypeRoutes = {
        newest: function() { return '/'; },
        top: function() { return '/top'; },
        user: function() {
            var userId = Meteor.userId();
            return userId ? '/user/' + userId : sortTypeRoutes.newest();
        }
    };

    Meteor.startup(function() {

        var customRoutes = {
            add: function() {
                $('#add-pair').modal();
            },
            top: function() {
                Session.set('sortType', 'top');
            }
        };

        Backbone.PushStateRouter({
            '': 'main',
            ':id': 'main',
            'user/:id': 'user'
        }, {
            main: function(id) {
                var customRoute = customRoutes[id];
                if (!id) { Session.set('sortType', 'newest'); }
                if (customRoute || !id) { id = null; }
                if (customRoute) { customRoute(); }
                Session.set('currentPairId', id);
            },
            user: function(id) {
                Session.set('currentPairId', null);
                Session.set('sortType', 'user');
                Session.set('viewUserId', id);
            }
        });
    });

    function tryNext() {
        tryArrow();
    }

    function hasArrow(prev) {
        return $(prev ? '#prev-pair' : '#next-pair').size();
    }

    function tryArrow(prev) {
        var $next = $(prev ? '#prev-pair' : '#next-pair');
        log('[TRY-NEXT]', prev, '$next', $next.attr('href'));
        if ($next.size()) {
            scWidget.pause();
            Backbone.history.navigate($next.attr('href'), true);
            return true;
        }
        return false;
    }

    Meteor.startup(function() {

        // SoundCloud html5 widget
        // [docs](http://developers.soundcloud.com/docs/api/html5-widget)
        scWidget = SC.Widget('widget');
        window.scWidget = scWidget; //TODO - unexpose this

        scWidget.bind(SC.Widget.Events.READY, function() {
            log('[SC.READY]');
            scWidget.bind(SC.Widget.Events.PLAY, function() {
                log('[SC.PLAY]');
                viewer.fadeInWidget();
                $('body').removeClass('paused-sc');
            });

            scWidget.bind(SC.Widget.Events.FINISH, tryNext);

            _.each(['PAUSE', 'FINISH'], function(x) {
                scWidget.bind(SC.Widget.Events[x], seekWidget.stop);
            });
        });
    });
}

if (Meteor.isServer) {

    var pairsLimit = 24;

    Meteor.publish('pairs', function(pairId, lastCreated, sortType, viewUserId) {
        if (pairId) {
            return null;
        }

        var query = {},
            sort = {'created': -1};

        if (sortType == 'user') {
            query.userId = viewUserId;
        } else if (sortType == 'top') {
            sortType = {'votes': 1};
        }

        if (lastCreated) {
            query.created = {'$lt': lastCreated};
        }
        return Pairs.find(query, {sort: sort, limit: pairsLimit});
    });

    Meteor.publish('pair', function(pairId) {
        return Pairs.find({_id: pairId});
    });

    Meteor.publish('prevPair', function(currentCreated) {
        return lookupNext(currentCreated, true, true);
    });

    Meteor.publish('nextPair', function(currentCreated) {
        return lookupNext(currentCreated, false, true);
    });

    Meteor.startup(function () {
        // code to run on server at startup
    });

    Meteor.methods({
        fixCreated: function() {
            Pairs.find({}).forEach(function(x) {
                if (!/^\d+$/.test(x.created)) {
                    var t;
                    try {
                        t = (new Date(x.created)).getTime();
                        if (isNaN(t.getTime())) {
                            throw new Error('not a number!');
                        }
                    } catch(e) {
                        t = createdNow();
                    }
                    Pairs.update({_id: x._id}, {$set: {created: t}});
                };
            });
        },
        fixImgur: function() {
            Pairs.find({}).forEach(function(x) {
                var imgur = 'http://imgur.com', img;
                if (x.image.indexOf(imgur) == 0) {
                    img = 'http://i.imgur.com' + x.image.slice(imgur.length);
                    Pairs.update({_id: x._id}, {$set: {image: img}});
                }
            });
        }
    });
}

if (Meteor.isClient && renderLogDebug) {
    function logRenders() {
        _.each(Template, function (template, name) {
            var oldRender = template.rendered;
            var counter = 0;
            template.rendered = function () {
                renderLog('[RENDER]', name, 'render count: ', ++counter);
                oldRender && oldRender.apply(this, arguments);
            };
        });
    }
    logRenders();

    if (false) {
        var wrappedFind = Meteor.Collection.prototype.find;
        Meteor.Collection.prototype.find = function() {
                var cursor = wrappedFind.apply(this, arguments);
                var collectionName = this._name;

            cursor.observeChanges({
                added: function (id, fields) {
                    renderLog('[FIND]', collectionName, 'added', id, fields);
                },
                changed: function (id, fields) {
                    renderLog('[FIND]', collectionName, 'changed', id, fields);
                },
                movedBefore: function (id, before) {
                    renderLog('[FIND]', collectionName, 'movedBefore', id, before);
                },
                removed: function (id) {
                    renderLog('[FIND]', collectionName, 'removed', id);
                }
            });
            return cursor;
        };
    }
}




// Ideas:
//
// *   meteor add less and just write in less
// *   one page app - all files load on one page
// *   html file is parts: head / body / templates
// *   change file names so not all the same! app.js / style.css
// *   reactivity and template updates happens via Session variables
// *   use subscribe to limit what data is shared and better
//     use autorun wrapper to update based on Session variables
