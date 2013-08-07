
// TODO
//
// *   proper time-decay sorting
// *   remixing of an existing picdinner
// *   simple gif search - maybe just scrape http://www.reddit.com/r/woahdude.json & http://www.reddit.com/r/gifs.json?
// *   simple soundcloud search
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

var _invalidUsernames = {};
_.forEach(
    ('login logout signin signout ' +
     'user users username profile people ' +
     'about contact all info browse search ' +
     'tag tags category categories ' +
     'top recent best ' +
     'hot new rising controversial saved ' +
     'preferences blog wiki ' +
     'b u s q p ' +
     'picdinner picdin admin administrator official ' +
     'you anon anonymous unnamed mrcoles petercoles meteor ' +
     'password changepassword').split(' '),
    function(x) { _invalidUsernames[x] = 1; }
);

function isValidUsername(username) {
    return /^[A-Za-z\u00C0-\u017F0-9_-]+$/.test(username) &&
        !_invalidUsernames[username.toLowerCase().replace(/[^a-z]+/, '')];
}

Meteor.users.allow({
    insert: function(userId, doc) {
        return false;
    },
    update: function(userId, doc, fields, modifier) {
        var validUpdates = {
            username: function() {
                if (!modifier || !modifier.$set || !modifier.$set.username) {
                    return false;
                }
                var username = modifier.$set.username;
                if (!isValidUsername(username)) {
                    return false;
                }
                return true;
            }
        };

        for (var i=0, len=fields.length; i<len; i++) {
            if (!validUpdates[fields[i]] || !validUpdates[fields[i]]()) {
                return false;
            }
        }

        return userId === doc._id;
    },
    remove: function(userId, doc) {
        return userId && userId === doc._id;
    }
});


var sortTypeSorts = {
    _: {'created': -1}, // catch-all
    top: {'score': -1}
};

function lookupNext(curCreated, curScore, sortType, viewUserId, prev, asFind) {
    if (!curCreated) return null;
    curScore = curScore || 0;

    var query = {};
    if (sortType == 'top') {
        query.score = prev ? {'$gt': curScore} : {'$lt': curScore};
    } else {
        query.created = prev ? {'$gt': curCreated} : {'$lt': curCreated};
    }
    if (viewUserId) {
        query.userId = viewUserId;
    }

    var sort = {};
    _.each(sortTypeSorts[sortType] || sortTypeSorts._, function(v, k) {
        sort[k] = prev ? -1*v : v;
    });

    return Pairs[asFind ? 'find' : 'findOne'](query, {
        sort: sort,
        limit: 1
    });
}


if (Meteor.isClient) {

    function getBackUrl() {
        var viewUserId = Session.get('viewUserId');
        return (sortTypeRoutes[Session.get('sortType')] ||
                sortTypeRoutes._)(viewUserId);
    }

    function isEmbed() {
        return ('|'+window.location.href.split('#')[1]+'|')
            .indexOf('|embed|') != -1;
    }
    function isAutoplay() {
        return AUTOPLAY ? !isEmbed() : false;
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

        function setVolume(volume) {
            scWidget.setVolume(volume === undefined ? 100 : volume);
        }

        if (!seconds) {
            setVolume();
            scWidget.play();
            return;
        }

        var time = Math.round(seconds * 1000);
        setVolume(0);
        scWidget.play();

        scWidget.getDuration(function(duration) {
            if (time >= duration) {
                setVolume();
            }

            (function doSeek() {
                scWidget.seekTo(time);
                setVolume(0); // in ff first setVolume(0) doesn't work, so try again

                // this basically waits for the widget to load the sound, continually
                // seeking to the furthest loaded point until the target is reached
                scWidget.getPosition(function(position) {
                    if (self.playCounter == playCounter) {
                        if (position >= time) {
                            setVolume();
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



    // ugh sniff mobile to show fewer pairs per page
    var mobileUserAgentsRes = [/mobile/i, /android/i, /iphone/i, /ipad/i];
    var isMobile = _.any(mobileUserAgentsRes, function(re) {
        return re.test(navigator.userAgent);
    });
    var pairsLimit = isMobile ? 12 : 24;


    // auto update pair subscription when it changes

    Deps.autorun(function() {
        var curPairId = Session.get('currentPairId'),
            viewUserId = Session.get('viewUserId'),
            sortType = Session.get('sortType'),
            page = Session.get('page');
        Meteor.subscribe('pairs', sortType, page, pairsLimit,
                         curPairId, viewUserId);
    });

    Deps.autorun(function() {
        var curPairId = Session.get('currentPairId');
        Meteor.subscribe('pair', curPairId);
    });

    Deps.autorun(function() {
        var curCreated = Session.get('currentCreated'),
            curScore = Session.get('currentScore'),
            sortType = Session.get('sortType'),
            viewUserId = Session.get('viewUserId');
        Meteor.subscribe('prevPair', curCreated, curScore,
                         sortType, viewUserId);
        Meteor.subscribe('nextPair', curCreated, curScore,
                         sortType, viewUserId);
    });

    Deps.autorun(function() {
        Meteor.subscribe('allUsers');
    });

    //
    // Options
    //
    Template.options.sortType = function() {
        return Session.get('sortType');
    };

    var optionsEvents = {};

    _.each(['newest', 'top', 'user'], function(x) {
        var className = 'type-' + x;
        Template.options[x] = function() {
            return className + ' ' +
                (Session.get('sortType') == x ? 'strong' : '');
        };
        optionsEvents['click .' + className] = function() {
            Paginator.reset();
        };
    });

    Template.options.events(optionsEvents);

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
                    $form.find('input').val('');
                    Session.set('formErrorMessage', null);
                    Session.set('formNoImage', false);
                    Session.set('currentPairId', _id);
                    Session.set('sortType', 'newest');
                    Paginator.reset();

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

    Template.pairs.pairs = function() {
        return Pairs.find(
            {},
            {sort: sortTypeSorts[Session.get('sortType')] || sortTypeSorts._,
             limit: pairsLimit}
        );
    };

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
    // Pagination
    //

    var Paginator = (function() {
        Session.set('hasPrev', false);
        var page = 1;
        var self = {
            next: function(e) {
                e.preventDefault();
                page += 1;
                self._update();
                self._scrollTop();
            },
            prev: function(e) {
                e.preventDefault();
                if (page > 1) {
                    page -= 1;
                }
                self._update();
                self._scrollTop();
            },
            reset: function() {
                page = 1;
                self._update();
            },
            _update: function() {
                Session.set('page', page);
                var hasPrev = Session.equals('hasPrev', true);
                if (page > 1 && !hasPrev) {
                    Session.set('hasPrev', true);
                } else if (page == 1 && hasPrev) {
                    Session.set('hasPrev', false);
                }
            },
            _scrollTop: function() {
                var $pairs = $('#pairs'),
                    $window = $(window),
                    top = $pairs.offset().top - 20;
                if (top < $window.scrollTop()) {
                    $('html,body').animate({scrollTop: top}, 1000);
                }
            }
        };
        self._update();
        return self;
    })();

    Template.pagination.hasPrev = function() {
        return Session.get('hasPrev');
    };
    Template.pagination.hasNext = function() {
        return Pairs.find({}).count() >= pairsLimit;
    };

    Template.pagination.events({
        'click .next': Paginator.next,
        'click .prev': Paginator.prev
    });

    //
    // Head
    //

    Template.head.pageUserId = function() {
        return Session.get('viewUserId');
    };

    Template.head.events({
        'click h1>a': function() {
            Paginator.reset();
        }
    });

    //
    // Add username
    //
    Template.addUsername.errorMessage = function() {
        return Session.get('addUsernameError');
    };

    Template.addUsername.events({
        'submit form': function(e) {
            e.preventDefault();
            Session.set('addUsernameError', null);
            var $input = $('#id_username'),
                username = $.trim($input.val()),
                user = Meteor.user();
            Meteor.users.update({_id: user._id}, {
                $set: {username: username}
            }, function(error) {
                if (error) {
                    switch (error.error) {
                      case 409:
                        // duplicate key
                        Session.set('addUsernameError',
                                    'The username "' + username +
                                    '" already exists :\'(');
                        break;
                      case 403:
                        // access denied
                        Session.set('addUsernameError',
                                    'Invalid username. ' +
                                    'Please try another one ' +
                                    ' with only letters, numbers, ' +
                                    'dashes, and underscores.');
                        break;
                    default:
                        Session.set('addUsernameError', error.message);
                        break;
                    }
                }
            });
        }
    });


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
        startTime: 0,
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
                    this.pairId = pairId;
                    this.startTime = pair.startTime;

                    if (!isAutoplay()) {
                        Session.set('showMobilePlay', !isSoundCloud);
                    }

                    if (isSoundCloud) {
                        this.playSoundCloud(pair, pairId, $viewImage);
                    } else {
                        this.playSimple(pair.audio);
                    }

                    this.active = true;

                    // animate header on first page load (if viewing a pair)
                    if (!this.didFirstUpdate) {
                        var $h = $('#head').addClass('trans');
                        Meteor.setTimeout(function() {
                            $h.addClass('go');
                            Meteor.setTimeout(function() {
                                $h.removeClass('trans').removeClass('go');
                            }, 2000);
                        }, 500);
                    }
                }

                // manually update image content to prevent reactive flickers
                if ($viewImage.attr('src') != pair.image) {
                    var opts = {};
                    if (isSoundCloud) {
                        opts.marginBottom = 166;
                        $viewImage.addClass('full');
                    } else {
                        $viewImage.removeClass('full');
                    }
                    $viewImage.attr('src', pair.image).expandImage(opts);
                }

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
        playSimple: function(audio) {
            var au = $.extend(new Audio(), {
                //loop: true, - manage loop in `ended`
                autoplay: isAutoplay()
            });

            $('html').addClass('show-arrows');

            $(au).on('play', function(e) {
                log('[AU.PLAY]', e);
                Session.set('showMobilePlay', false);
            }).on('playing', function(e) {
                log('[AU.PLAYING]', e);
            }).on('ended', function(e) {
                log('[AU.ENDED]', e);
                tryNext();
            });

            // cross browser support ogg vs mp3
            var src = audio;
            if (au.canPlayType('audio/ogg')) {
                var sp = src.split('.');
                sp.pop();
                sp.push('ogg');
                src = sp.join('.');
            }

            au.src =  src;
            this.audio = au;
        },
        playSoundCloud: function(pair, pairId, $viewImage) {
            $viewImage.fadeOut(0);
            scWidget.load(pair.audio, {
                callback: function() {
                    log('[SC.CALLBACK]');
                    viewer.fadeInWidget();

                    if (!isAutoplay()) {
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
        },
        clear: function() {
            $('body').removeClass('paused-sc').removeClass('in-viewer');
            $('html').removeClass('show-arrows');

            if (this.pairId) {
                this.pairId = null;
                this.startTime = 0;
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
        Session.set('currentScore', p ? p.score : null);
        return p;
    };

    function voteState(pair, upvoted) {
        var key = (upvoted === undefined || upvoted === true) ?
            'upvoters' : 'downvoters';
        return pair && pair[key] && _.contains(pair[key], Meteor.userId());
    }
    Template.viewPair.hasUpvoted = function(pair) {
        return voteState(pair, true);
    };
    Template.viewPair.hasDownvoted = function(pair) {
        return voteState(pair, false);
    };

    Template.viewPair.isEmbed = isEmbed;

    Template.viewPair.showEmbed = function() {
        return isAutoplay();
    };

    Template.viewPair.prevPair = function() {
        if (isEmbed()) return null;
        var curCreated = Session.get('currentCreated');
        var curScore = Session.get('currentScore');
        var sortType = Session.get('sortType');
        var viewUserId = Session.get('viewUserId');
        return lookupNext(curCreated, curScore, sortType, viewUserId, true);
    };

    Template.viewPair.nextPair = function() {
        if (isEmbed()) return null;
        var curCreated = Session.get('currentCreated');
        var curScore = Session.get('currentScore');
        var sortType = Session.get('sortType');
        var viewUserId = Session.get('viewUserId');
        return lookupNext(curCreated, curScore, sortType, viewUserId, false);
    };

    Template.viewPair.isSoundCloud = function(audio) {
        return viewer.isSoundCloud(audio);
    };

    Template.viewPair.isTouch = function() {
        return $('html').hasClass('touch');
    };

    Template.viewPair.backUrl = getBackUrl;

    Template.viewPair.mobileClick = function() {
        return !isAutoplay() && Session.get('currentPairId') &&
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
        },
        'click .vote': function(e) {
            var $this = $(e.target).closest('.vote'),
                isUp = $this.hasClass('up'),
                isActive = $this.hasClass('active'),
                method = (isUp ?
                          (isActive ? 'cancelUpvotePair' : 'upvotePair') :
                          (isActive ? 'cancelDownvotePair' : 'downvotePair'));

            Meteor.call(method, Session.get('currentPairId'));
        },
        'click .embed': function(e) {
            e.preventDefault();
            $('#embed-pair').modal().find('input[selected]').click();
        }
    });

    Template.embedPair.embedCode = function() {
        var height = parseInt(Session.get('embedHeight')) || 400,
            url = window.location.href.split('#')[0],
            embedUrl = url + '#embed',
            _ = Handlebars._escape;
        Session.get('currentPairId'); // force reactivity on pair change
        return ('<iframe width="100%" height="' + height +
                '" src="' + _(embedUrl) + '" frameborder="0"></iframe>' +
                '<p>An audio/video <a href="' + _(url) + '" ' +
                'target="_blank">pairing</a> ' +
                'courtesy of <a href="http://picdinner.com">PicDinner</a>.</p>');
    };

    Template.embedPair.events({
        'click input[type=radio]': function(e) {
            var $this = $(e.target).closest('input'),
                height = $this.val();
            Session.set('embedHeight', parseInt(height));
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
        _: function() { return '/'; }, // catch-all
        newest: function() { return '/newest'; },
        user: function(viewUserId) {
            return viewUserId ? '/user/' + viewUserId : sortTypeRoutes.newest();
        }
    };

    Meteor.startup(function() {

        var customRoutes = {
            add: function() {
                $('#add-pair').modal();
            },
            newest: function() {
                Session.set('sortType', 'newest');
            }
        };

        Backbone.PushStateRouter({
            '': 'main',
            ':id': 'main',
            'user/:id': 'user'
        }, {
            main: function(id) {
                if (id) id = id.split('#')[0];
                var customRoute = customRoutes[id];
                if (!id) { Session.set('sortType', 'top'); }
                if (customRoute || !id) {
                    id = null;
                    // only clear viewUserId when we're not viewing
                    // a pair directly
                    Session.set('viewUserId', null);
                }
                if (customRoute) { customRoute(); }
                viewer.active = !!id;
                Session.set('currentPairId', id);
            },
            user: function(id) {
                if (id) id = id.split('#')[0];
                viewer.active = false;
                Session.set('currentPairId', null);
                Session.set('sortType', 'user');
                Session.set('viewUserId', id);
            }
        });
    });

    function tryNext() {
        tryArrow();
    }
    window._tryNext = tryNext;

    function hasArrow(prev) {
        return $(prev ? '#prev-pair' : '#next-pair').size();
    }

    function tryArrow(prev) {
        var $next = $(prev ? '#prev-pair' : '#next-pair'),
            hash = window.location.href.split('#')[1],
            url = $next.attr('href') + (hash ? '#'+hash : '');
        log('[TRY-NEXT]', prev, '$next', url);
        if ($next.size()) {
            scWidget.pause();
            Backbone.history.navigate(url, true);
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

                var $body = $('body');
                if ($body.hasClass('paused-sc')) {
                    $body.removeClass('paused-sc');
                    seekWidget(viewer.startTime); // need to handle seek-to for mobile
                }
            });

            scWidget.bind(SC.Widget.Events.PLAY_PROGRESS, function() {
                // HACK - ugh.. in mobile version play doesn't work on
                // but somehow binding an event here makes it happen...
            });

            scWidget.bind(SC.Widget.Events.FINISH, tryNext);

            _.each(['PAUSE', 'FINISH'], function(x) {
                scWidget.bind(SC.Widget.Events[x], seekWidget.stop);
            });
        });
    });
}

if (Meteor.isServer) {
    Meteor.publish('pairs', function(sortType, page, pairsLimit, curPairId, viewUserId) {
        if (curPairId) {
            return null;
        }

        var query = {},
            sort = sortTypeSorts[sortType] || sortTypeSorts._,
            options = {
                limit: pairsLimit,
                fields: {
                    _id: 1,
                    audio: 1,
                    image: 1,
                    created: 1,
                    score: 1,
                    userId: 1,
                    startTime: 1
                }
            };

        if (page > 1) {
            options.skip = (page-1)*pairsLimit;
        }

        if (viewUserId) {
            query.userId = viewUserId;
        }

        options.sort = sort;

        return Pairs.find(query, options);
    });

    Meteor.publish('pair', function(pairId) {
        return Pairs.find({_id: pairId});
    });

    Meteor.publish('prevPair', function(curCreated, curScore, sortType, viewUserId) {
        return lookupNext(curCreated, curScore, sortType, viewUserId, true, true);
    });

    Meteor.publish('nextPair', function(curCreated, curScore, sortType, viewUserId) {
        return lookupNext(curCreated, curScore, sortType, viewUserId, false, true);
    });

    Meteor.publish('allUsers', function() {
        return Meteor.users.find({}, {fields: {_id: 1, username: 1}});
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
