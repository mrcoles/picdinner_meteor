(function() {

    var imgHeight,
        imgWidth,
        $img,
        active,
        opts = {},
        defaultOpts = {
            marginBottom: 0 //TODO - add other margins
        };

    function clearDims() {
        active = false;
        imgHeight = imgWidth = null;
        $(window).off('resize.expand-image');
    }

    function getDims(src) {
        clearDims();
        var im = new Image();
        im.onload = function() {
            imgHeight = im.height;
            imgWidth = im.width;
            active = true;
            $(window).on('resize.expand-image', function() {
                if (active) {
                    expand();
                }
            });
            expand();
        };
        im.src = src;
    }

    function expand() {
        if (!active) return;
        var hr, wr, r, img,
            wH = window.innerHeight,
            wW = window.innerWidth;
        if (imgHeight && imgWidth) {
            wH -= opts.marginBottom;
            if (wH < 0) wH = 0;
            hr = wH / imgHeight,
            wr = wW / imgWidth;
            r = hr < wr ? hr : wr;
            img = $img[0];
            img.width = imgWidth * r;
            img.height = imgHeight * r;
        }
    }

    $.fn.expandImage = function(arg) {
        if (arg == 'clear') {
            clearDims();
        } else {
            opts = $.extend({}, defaultOpts, $.isPlainObject(arg) ? arg : {});
            $img = this.first();
            getDims($img.attr('src'));
        }
        return this;
    };

})();
