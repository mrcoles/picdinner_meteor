// Peter Coles - mrcoles.com - 2013

(function($, window, undefined) {

    $.stopgifs = {
        defaults: {
            hoverAnimate: true // enable animate during hover
            // background (fn or str) fill style for canvas bg during load
            // parentClosest (str) jquery closest selector for hiding on error
        }
    };

    var cache = {};

    $.fn.stopgifs = function(opts) {
        opts = $.extend({}, $.stopgifs.defaults, opts);

        // no hover animate on touch
        if (navigator.userAgent.match(/(iPhone|iPad)/i)) {
            opts.hoverAnimate = false;
        }

        return this.each(function() {
            var $img = $(this);

            if ($img.data('stopgifsSetup'))
                return;

            $img.data('stopgifsSetup', true);

            if ($img.hasClass('thumb')) {
                $img.thumbgifs(opts);
                return;
            }

            $img.hide();

            var $parent = $img.parent(),
                width = opts.width ? opts.width : $parent.width(),
                height = opts.height ? opts.height : $parent.height(),
                $canvas = $('<canvas>').insertAfter($img),
                canvas = $canvas.get(0),
                ctx = canvas.getContext('2d'),
                src = $img.attr('src'),
                cached = cache[src];

            function updateDims(img) {
                canvas.width = width;
                canvas.height = height;
                if (img) {
                    ctx.clearRect(0, 0, width, height);
                    ctx.drawImage(img, 0, 0, width, height);
                }
            }

            updateDims();

            if (cached) {
                height = cached.height;
                width = cached.width;
                updateDims(cached.img);
            } else if (opts.background) {
                ctx.fillStyle = $.isFunction(opts.background) ?
                    opts.background() : opts.background;
                ctx.fillRect(0, 0, width, height);
            }

            if (opts.hoverAnimate) {
                $parent.hover(function() {
                    $canvas.hide();
                    $img.show();
                }, function() {
                    load();
                    $img.hide();
                    $canvas.show();
                });
            }

            function load() {
                // separate function for hoverAnimate
                $('<img>', {
                    src: src,
                    load: function() {
                        var w = this.width,
                            h = this.height,
                            ratioW = width / w,
                            ratioH = height / h,
                            ratio = ratioW < ratioH ? ratioW : ratioH;
                        width = w * ratio;
                        height = h * ratio;
                        cache[src] = {
                            img: this,
                            width: width,
                            height: height
                        };
                        updateDims(this);
                    },
                    error: function() {
                        (opts.parentClosest ?
                         $img.closest(opts.parentClosest) :
                         $img).hide();
                        console.log('bad image src', src);
                    }
                });
            }
            !cached && load();
        });
    };

    $.fn.thumbgifs = function(opts) {
        return this.each(function() {
            if (!opts.hoverAnimate)
                return;

            var $img = $(this),
                src = $img.data(opts.dataSrc || 'fullsrc'),
                $parent = $img.parent(),
                inited = false,
                hovering = false,
                $fullImg;

            function hoverOn() {
                $img.hide();
                $fullImg.show();
            }
            function hoverOut() {
                $fullImg.hide();
                $img.show();
            }

            function init() {
                inited = true;
                var $loader = $('<img>', {
                    src: src,
                    'class': opts.fullClass || 'full-image',
                    load: function() {
                        $fullImg = $loader.appendTo($parent).hide();
                        if (hovering) {
                            hoverOn();
                        }
                    },
                    error: function() {
                        (opts.parentClosest ?
                         $img.closest(opts.parentClosest) :
                         $img).hide();
                        console.log('bad image src', src);
                    }
                });
            }

            $parent.hover(function() {
                if (!inited) {
                    init();
                } else {
                    hoverOn();
                }
                hovering = true;
            }, function() {
                hoverOut();
                hovering = false;
            });
        });
    };
})(jQuery, this);
