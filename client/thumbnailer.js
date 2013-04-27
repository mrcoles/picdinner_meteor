
thumbnailer = function(source) {
    var r;

    // imgur
    r = /^http:\/\/([^\/]+\.)?imgur.com\/.+\.[^\.]+$/;
    if (r.test(source)) {
        source = source.split('.');
        source[source.length - 2] += 's';
        return source.join('.');
    }

    // minus
    r = /^http:\/\/(i[^.]*\.)?minus\.com\/([^\.]+)\.[^\.]+$/i;
    if (r.test(source)) {
        source = source.match(r)[2];
        return 'http://i.minus.com/j' + source.substring(1) + '_q.jpg';
    }

    return null;
}
