
Pairs = new Meteor.Collection('pairs');

Pairs.allow({
    insert: function(userId, doc) {
        return true;
    },
    update: function(userId, docs, fields, modifier) {
        return false;
    },
    remove: function(userId, docs) {
        return false;
    }
});

if (Meteor.isClient) {

    Meteor.subscribe('pairs');

    // auto update pair subscription when it changes
    Meteor.autosubscribe(function() {
        Meteor.subscribe('pair', Session.get('currentPairId'));
    });

    //
    // Head
    //
    Template.head.events({
        'click #add': function() {
            $('#add-pair').modal();
        }
    });

    //
    // Add Pair
    //
    Template.addPair.formNoImage = function() {
        return Session.get('formNoImage');
    };

    Template.addPair.events({
        'submit form': function(e) {
            e.preventDefault();
            var $form = $(e.target),
                $image = $form.find('input[name=image]'),
                $audio = $form.find('input[name=audio]'),
                image = $image.val(),
                audio = $audio.val();

            if (!audio) { audio = 'song.mp3'; }

            if (!image) {
                Session.set('formNoImage', true);
                //TODO - maybe this should be part of allow/deny instead?
                return;
            }

            var _rImgur = /^https?:\/\/imgur.com/i,
                _rSuffix = /\.[^\/]+$/i;

            if (_rImgur.test(image) && !_rSuffix.test(image)) {
                var t = image.split('/').pop();
                image = 'http://imgur.com/' + t + '.gif';
            }

            var id = Pairs.insert({
                image: image,
                audio: audio,
                created: (new Date()).getTime()
            });

            recents.add(id);

            $form.find('input').val('');
            Session.set('formNoImage', false);
            $('#add-pair').modal('hide');
        },
        'change input, keyup input': function() {
            Session.set('formNoImage', false);
        }
    });

    //
    // Pairs
    //
    Template.pairs.pairs = function() {
        return Pairs.find({}, {sort: {"created": -1}});
    };

    Template.pairs.events({
        'click .pair': function(e) {
            // NOTE - `this` is actually "pair" from the each
            // loop in the template
            var H = window.History;
            if (H.enabled) {
                e.preventDefault();
                H.pushState(null, null, '/' + this._id);
            }
        }
    });

    Template.pairs.rendered = function() {
        var colors = 'fdd dfd ddf ffd fdf dff'.split(' '),
            i = 0,
            len = colors.length;
        function bgFn() {
            if (i >= len) i = 0;
            return '#' + colors[i++];
        }
        $('#pairs').find('a.pair>img').stopgifs({
            parentClosest: '.pair',
            background: bgFn
        });
    };

    //
    // History
    //
    var recents = {
        get: function() {
            var h, th;
            try {
                th = JSON.parse(localStorage.getItem('recents'));
                h = [];
                _.each(th, function(x) {
                    if (x) { h.push(x); }
                });
            } catch(e) {}
            if (!h) { h = []; }
            return h;
        },
        add: function(_id) {
            var h = recents.get();
            if (_id) h.unshift(_id);
            h = h.slice(0, 5);
            localStorage.setItem('recents', JSON.stringify(h));
            Session.set('recents', h);
            return recents;
        }
    };
    recents.add();

    Template.history.history = function() {
        var names = 'Dengus, Paynuss, Fibbus, Chonus, Taargus'.split(', '),
            i = 0;
        return _.map(Session.get('recents'), function(id) {
            return {id: id, name: names[i++] || id};
        });
    };

    //
    // Shares Base
    //
    Template.sharesPrimary.shareUrls = function() {
        //TODO - not have to do the stupid list as a hack
        //       to use parent templates, e.g., sharesPrimary
        return [{shareUrl: 'http://picdinner.com'}];
    };

    Template.sharesSecondary.shareUrls = function() {
        var id = Session.get('currentPairId');
        return id ? [{shareUrl: 'http://picdinner.com/'+id}] : [];
    };

    //
    // View Pair
    //
    var viewer = {
        active: false,
        pairId: null,
        audio: null,
        update: function(pairId, pair) {
            // open
            if (pair) {
                if (!this.pairId || this.pairId != pairId) {
                    var isSoundCloud = this.isSoundCloud(pair.audio);
                    var au = isSoundCloud ? null :
                        $.extend(new Audio(), {
                            autoplay: true,
                            loop: true,
                            src: pair.audio
                        });
                    this.audio = au;
                    this.pairId = pairId;
                    var arg = isSoundCloud ? {marginBottom: 166} : {};
                    $('#view-image').expandImage(arg);
                    this.active = true;

                    if (this.pageLoad) {
                        this.pageLoad = false;
                        // animate head
                        var $h = $('#head').addClass('trans');
                        Meteor.setTimeout(function() {
                            $h.addClass('go');
                            Meteor.setTimeout(function() {
                                $h.removeClass('trans').removeClass('go');
                            }, 4000);
                        }, 500);
                    }
                }

            // close
            } else if (!pairId) {
               // TODO - weird hack checking for pairId for case
                // when pair doesn't exist immediately at page load
                if (this.pairId) {
                    this.pairId = null;
                    if (this.audio) {
                        this.audio.pause();
                        this.audio = null;
                    }
                    $('#view-image').expandImage('clear');
                }

                var H = window.History, state = H.getState();
                if (H.enabled && /https?:\/\/[^\/]+\/.+$/.test(state.url)) {
                    H.pushState(null, null, '/');
                }

                this.active = false;
            }
        },
        toggleAudio: function() {
            if (this.audio) {
                this.audio[this.audio.paused ? 'play' : 'pause']();
            }
        },
        isSoundCloud: function(audio) {
            return audio && /^https?:\/\/soundcloud.com\/.+/i.test(audio);
        }
    };

    Template.viewPair.pair = function() {
        return Pairs.findOne({'_id': Session.get('currentPairId')});
    };

    Template.viewPair.isSoundCloud = function(audio) {
        return viewer.isSoundCloud(audio);
    };

    Template.viewPair.rendered = function() {
        viewer.update(Session.get('currentPairId'), Template.viewPair.pair());
        SharesLoader.load();
    };

    Template.viewPair.events({
        'click': function(e) {
            if (!$(e.target).filter('img').size()) {
                Session.set('currentPairId', null);
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
    });


    //
    // URL Routing - statechange
    //
    Meteor.startup(function() {

        //
        // push state
        //
        var H = window.History;

        function stateChange(e, pageLoad) {
            var state = H.getState(),
                id = null;
            if (/^https?:\/\/[^\/]+\/[^\/]*$/i.test(state.url)) {
                id = state.url.split('/')[3] || null;
                if (id && pageLoad) {
                    viewer.pageLoad = true;
                }
            }
            Session.set('currentPairId', id);
        }

        H.Adapter.bind(window, 'statechange', stateChange);

        stateChange(null, true);

        //
        // recents
        //
        $('#history').on('click', 'a', function(e) {
            var H = window.History;
            if (H.enabled) {
                e.preventDefault();
                H.pushState(null, null, $(this).attr('href'));
            }
        });
    });
}

if (Meteor.isServer) {

    var pairsLimit = 15;

    Meteor.publish('pairs', function() {
        return Pairs.find({}, {sort: {'created': -1}, limit: pairsLimit});
    });

    Meteor.publish('pair', function(pairId) {
        return Pairs.find({_id: pairId});
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
                        t = (new Date).getTime();
                    }
                    Pairs.update({_id: x._id}, {$set: {created: t}});
                };
            });
        }
    });
}




// Ideas:
//
// *   meteor add less and just write in less
// *   one page app - all files load on one page
// *   html file is parts: head / body / templates
// *   change file names so not all the same! app.js / style.css
// *   reactivity and template updates happens via Session variables
// *   use subscribe to limit what data is shared and better
//     use autosubscribe wrapper to update based on Session variables

// TODO:
//
// *   only play music when in foreground
// *   better way to select gifs and music
// *   extras? crazy backgrounds instead of #111? (text or title? -- too much?)
// *   image and sound upload
// *   thumbs of images (via canvas?)... and way to visualize sound?
// *   social stuff ... top pics, colors for viewing, login
// *   navigation to other pictures
