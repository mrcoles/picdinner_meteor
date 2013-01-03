
// Questions:
//
// Q. how is dom loaded in js? is there a post load hook?
// A. use Meteor.startup(function() { ... })
//
// Q. publish and subscribe?
// A. (for when autopublish is false?)

// Ideas:
//
// *   change file names so not all the same! app.js / style.css

// TODO:
//
// *   only play music when in foreground
// *   better way to select gifs and music
// *   extras? crazy backgrounds instead of #111? (text or title? -- too much?)
// *   image and sound upload
// *   thumbs of images... and way to visualize sound?
// *   social stuff ... top pics, colors for viewing, login, social share?
// *   navigation to other pictures

Pairs = new Meteor.Collection('pairs');

if (Meteor.isClient) {
    Template.pairs.pairs = function() {
        return Pairs.find({}, {sort: {"created": -1}});
    };

    var Viewer = {
        active: false,
        $get: function() {
            if (!this._$elt) {
                this._$elt = $('#view-pair');
            }
            return this._$elt;
        },
        init: function() {
            if (!this._didInit) {
                this._didInit = true;
                var self = this;
                this.$get().click(function(e) {
                    if (!$(e.target).filter('img').size()) {
                        self.hide();
                    }
                });
                $(window).keyup(function(e) {
                    if (self.active) {
                        if (e.which == 27) {
                            self.hide();
                        } else if (e.which == 32) {
                            if (self.audio) {
                                self.audio[self.audio.paused ? 'play' : 'pause']();
                            }
                        }
                    }
                });
                this.imgFit.init();
            }
        },
        stop: function() {
            if (this.audio) {
                this.audio.pause();
                this.audio = null;
            }
            this.active = false;
        },
        hide: function() {
            this.stop();
            this.$get().hide();
            var H = window.History, state = H.getState();
            if (H.enabled && /https?:\/\/[^\/]+\/.+$/.test(state.url)) {
                H.pushState(null, null, '/');
            }
        },
        start: function(opts, pageLoad) {
            var $v = this.$get(),
                au = new Audio();
            window.opts = opts;
            this.init();
            this.stop();
            au.autoplay = true;
            au.loop = true;
            au.src = opts.audio;
            this.audio = au;
            au.play();
            $v.find('img').attr('src', opts.image);
            Viewer.imgFit.setImg(opts.image);
            if (pageLoad) {
                var $h = $('#head').addClass('trans');
                window.setTimeout(function() {
                    $h.addClass('go');
                    window.setTimeout(function() {
                        $h.removeClass('trans').removeClass('go');
                    }, 4000);
                }, 500);
            }
            $v.show();
            this.active = true;
        },
        imgFit: {
            $img: function() {
                if (!this._$img) {
                    this._$img = Viewer.$get().find('img');
                }
                return this._$img;
            },
            setImg: function(path) {
                this.imgHeight = this.imgWidth = null;
                var self = this,
                    im = new Image();
                im.onload = function() {
                    self.imgHeight = im.height;
                    self.imgWidth = im.width;
                    self.$img().trigger('doFit');
                };
                im.src = path;
            },
            fn: function() {
                if (!Viewer.active) return;
                var hr, wr, r, img,
                    v = Viewer,
                    imgHeight = v.imgFit.imgHeight,
                    imgWidth = v.imgFit.imgWidth,
                    wH = window.innerHeight,
                    wW = window.innerWidth;
                if (imgHeight && imgWidth) {
                    // if (imgHeight <= wH && imgWidth <= wW) {
                    //     if (v.imgFitted) {
                    //         v.imgFitted = false;
                    //         img = v.imgFit.$img()[0];
                    //         img.width = 'auto';
                    //         img.height = 'auto';
                    //     }
                    // } else {
                        hr = wH / imgHeight,
                        wr = wW / imgWidth;
                        r = hr < wr ? hr : wr;
                        img = v.imgFit.$img()[0];
                        img.width = imgWidth * r;
                        img.height = imgHeight * r;
                    // }
                }
            },
            init: function() {
                var im = Viewer.imgFit;
                im.$img().on('load doFit', im.fn);
                $(window).on('resize', im.fn);
            }
        }
    };

    Template.pairs.events({
        'click .pair': function(e) {
            // NOTE - `this` seems to be the actual pair object?
            var H = window.History;
            if (H.enabled) {
                e.preventDefault();
                H.pushState(null, null, '/' + this._id);
            }
        }
    });

    Template.head.events({
        'click #add': function() {
            $('#add-pair').modal();
        }
    });

    Template.addPair.events({
        'submit form': function(e) {
            e.preventDefault();
            var $form = $(e.target),
                $image = $form.find('input[name=image]'),
                $audio = $form.find('input[name=audio]'),
                image = $image.val(),
                audio = $audio.val();

            if (!audio) { audio = 'song.mp3'; }

            Pairs.insert({image: image, audio: audio, created: (new Date()).toGMTString()});
            $('#add-pair').modal('hide');
        }
    });

    Meteor.startup(function() {
        var H = window.History,
            curStateId = null;

        function stateChange(e, pageLoad) {
            var state = H.getState();
            curStateId = state.id;
            if (/^https?:\/\/[^\/]+\/[^\/]*$/i.test(state.url)) {
                var id = state.url.split('/')[3];
                if (id) {

                    // NOTE - immediate infdOne on page load
                    // failed to return anything
                    // var p = Pairs.findOne({'_id': id});

                    var handle = Pairs.find({'_id': id}).observe({
                        added: function(pair) {
                            handle && handle.stop();
                            if (curStateId == state.id) {
                                Viewer.start(pair, pageLoad === true);
                            }
                        }
                    });
                } else {
                    Viewer.stop();
                }
            }
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
