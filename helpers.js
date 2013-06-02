if (Meteor.isClient) {

    // make particular session keys available globally
    // in the templates
    var SESSION_KEYS = 'currentPairId'.split(' ');

    _.each(SESSION_KEYS, function(key) {
        Handlebars.registerHelper(key, function(){
            return Session.get(key);
        });
    });

    Handlebars.registerHelper('getThumb', function(image) {
        return thumbnailer(image);
    });

    Handlebars.registerHelper('getUsername', function(userId) {
        var user = Meteor.users.findOne(userId);
        return user && user.username ? user.username : 'anonymous';
    });
}