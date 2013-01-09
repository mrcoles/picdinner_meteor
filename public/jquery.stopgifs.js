// Peter Coles - mrcoles.com - 2013

(function($, window, undefined) {

    $.stopgifs = {
        defaults: {
            hoverAnimate: true
        }
    };

    $.fn.stopgifs = function(opts) {
        opts = $.extend({}, $.stopgifs.defaults, opts);

        return this.each(function() {
            var $img = $(this);
            if ($img.data('stopgifsSetup')) return;
            $img.hide();

            var $parent = $img.parent(),
                width = opts.width ? opts.width : $parent.width(),
                height = opts.height ? opts.height : $parent.height(),
                $canvas = $('<canvas>').insertAfter($img),
                canvas = $canvas.get(0),
                ctx = canvas.getContext('2d');

            $img.data('stopgifsSetup', true);

            function updateDims() {
                canvas.width = width;
                canvas.height = height;
            }

            updateDims();

            if (opts.background) {
                canvas.fillStyle = $.isFunction(opts.background) ?
                    opts.background() : opts.background;
                canvas.fillRect(0, 0, width, height);
            }

            if (opts.hoverAnimate) {
                $parent.hover(function() {
                    $canvas.hide();
                    $img.show();
                }, function() {
                    $img.hide();
                    $canvas.show();
                    load();
                });
            }

            function load() {
                // separate function for hoverAnimate
                $('<img>', {
                    src: $img.attr('src'),
                    load: function() {
                        var w = this.width,
                            h = this.height,
                            ratioW = width / w,
                            ratioH = height / h,
                            ratio = ratioW < ratioH ? ratioW : ratioH;
                        width = w * ratio;
                        height = h * ratio;
                        updateDims();
                        ctx.clearRect(0, 0, width, height);
                        ctx.drawImage(this, 0, 0, width, height);
                    },
                    error: function() {
                        (opts.parentClosest ?
                         $img.closest(opts.parentClosest) :
                         $img).hide();
                    }
                });
            }
            load();
        });
    };

})(jQuery, this);
