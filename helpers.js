if (Meteor.isClient) {

    // make particular session keys available globally
    // in the templates
    var SESSION_KEYS = 'currentPairId'.split(' ');

    _.each(SESSION_KEYS, function(key) {
        Handlebars.registerHelper(key, function(){
            return Session.get(key);
        });
    });
}