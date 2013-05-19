
// Permissions

// user:                Defaults to Meteor.user()
// returnError:         If there's an error, should we return what the problem is?
//
// return true if all is well, false || an error string if not
canView = function(user, returnError) {
    user = (typeof user === 'undefined') ? Meteor.user() : user;

    if (Meteor.isClient)
        return false;

    return true;
};

canViewById = function(userId, returnError) {
    var user = Meteor.users.findOne(userId);
    return canView(user, returnError);
};

canPost = function(user, returnError) {
    user = (typeof user === 'undefined') ? Meteor.user() : user;

    if (Meteor.isClient)
        return false;

    if (!user) {
        return returnError ? "no_account" : false;
    } else if (isAdmin(user)) {
        return true;
    } else {
        return true;
    }
};

canPostById = function(userId, returnError) {
    var user = Meteor.users.findOne(userId);
    return canPost(user, returnError);
};

canUpvote = function(user, collection, returnError) {
    return canPost(user, returnError);
};

canUpvoteById = function(userId, returnError) {
    var user = Meteor.users.findOne(userId);
    return canUpvote(user, returnError);
};

canDownvote = function(user, collection, returnError) {
    return canPost(user, returnError);
};

canDownvoteById = function(userId, returnError) {
    var user = Meteor.users.findOne(userId);
    return canDownvote(user, returnError);
};

canEdit = function(user, item, returnError) {
    user = (typeof user === 'undefined') ? Meteor.user() : user;

    if (!user || !item) {
        return returnError ? "no_rights" : false;
    } else if (isAdmin(user)) {
        return true;
    } else if (user._id!==item.userId) {
        return returnError ? "no_rights" : false;
    } else {
        return true;
    }
};

canEditById = function(userId, item) {
    var user = Meteor.users.findOne(userId);
    return canEdit(user, item);
};

isAdmin = function(user) {
    return user ? Boolean(user.isAdmin) : false;
};
