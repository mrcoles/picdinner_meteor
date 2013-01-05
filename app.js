
// Questions:
//
// Q. how is dom loaded in js? is there a post load hook?
// A. use Meteor.startup(function() { ... })
//
// Q. publish and subscribe?
// A. (for when autopublish is false?)
//
// Q. 'click .pair' - this is the db object?
// A. it's actually the object from the for-loop!
//
//    > The handler function receives two arguments: event, an
//    > object with information about the event, and template,
//    > a template instance for the template where the handler
//    > is defined. The handler also receives some additional
//    > context data in this, depending on the context of the
//    > current element handling the event. In a Handlebars
//    > template, an element's context is the Handlebars data
//    > context where that element occurs, which is set by block
//    > helpers such as #with and #each.
//


// Ideas:
//
// *   meteor add less and just write in less
// *   one page app - all files load on one page
// *   html file is parts: head / body / templates
// *   change file names so not all the same! app.js / style.css
// *   find observe pattern on startup

// TODO:
//
// *   Pairs.allow({insert: function() { return true; }, remove: function() { return false; }, update: function(userId, docs, fields, modifier) {... }})
//
// *   only play music when in foreground
// *   better way to select gifs and music
// *   extras? crazy backgrounds instead of #111? (text or title? -- too much?)
// *   image and sound upload
// *   thumbs of images (via canvas?)... and way to visualize sound?
// *   social stuff ... top pics, colors for viewing, login, social share?
// *   navigation to other pictures

Pairs = new Meteor.Collection('pairs');

if (Meteor.isClient) {

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
    Template.addPair.events({
        'submit form': function(e) {
            e.preventDefault();
            var $form = $(e.target),
                $image = $form.find('input[name=image]'),
                $audio = $form.find('input[name=audio]'),
                image = $image.val(),
                audio = $audio.val();

            if (!audio) { audio = 'song.mp3'; }

            Pairs.insert({
                image: image,
                audio: audio,
                created: (new Date()).toGMTString()
            });
            $('#add-pair').modal('hide');
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

    //
    // View Pair
    //
    var viewer = {
        active: false,
        pair: null,
        audio: null,
        update: function(pair) {
            // open
            if (pair) {
                if (!this.pair || this.pair._id != pair._id) {
                    var au = $.extend(new Audio(), {
                        autoplay: true,
                        loop: true,
                        src: pair.audio
                    });
                    au.play();
                    this.audio = au;
                    this.pair = pair;
                    $('#view-image').expandImage();
                    this.active = true;
                }

            // close
            } else {
                if (this.pair) {
                    this.pair = null;
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
        }
    };

    Template.viewPair.pair = function() {
        return Pairs.findOne({'_id': Session.get('currentPairId')});
    };

    Template.viewPair.rendered = function() {
        viewer.update(Template.viewPair.pair());
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
        var H = window.History;

        function stateChange(e, pageLoad) {
            var state = H.getState(),
                id = null;
            if (/^https?:\/\/[^\/]+\/[^\/]*$/i.test(state.url)) {
                id = state.url.split('/')[3] || null;
            }
            Session.set('currentPairId', id);
        }

        H.Adapter.bind(window, 'statechange', stateChange);

        stateChange(null, true);
    });
}

if (Meteor.isServer) {
    Meteor.startup(function () {
        // code to run on server at startup
    });
}
