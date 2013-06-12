(function(undefined) {
    var getVotePower = function(user) {
        return (user && user.isAdmin) ? 5 : 1;
    };

    var startTime = 1360040800000;

    var updateScore = function(collection, id, forceUpdate) {
        // TODO - use a time-decay score algo
        var object = collection.findOne(id);
        var score = ((object.created - startTime) +
                     (10*365*24*60*60*1000) * (object.baseScore||0));
        var $set = {score: score};
        if (object.baseScore === undefined) $set.baseScore = 0;
        if (object.votes === undefined) $set.votes = 0;

        var isDiff = false;
        _.each($set, function(v, k) {
            if (object[k] !== v) {
                isDiff = true;
            }
        });

        if (isDiff) {
            //console.log('UPDATE', id, $set);
            collection.update({_id: id}, {$set: $set});
        }
    };

    var hasUpvotedItem = function(user, collection, id) {
        // see http://www.mongodb.org/display/DOCS/MongoDB+Data+Modeling+and+Rails
        // 'is there an item with this id which contains this userId in its upvoters?'
        // if such an item  exists, it means we have voted.
        return collection.findOne({_id: id, upvoters: user._id}) !== undefined;
    };

    var hasDownvotedItem= function(user, collection, id) {
        return collection.findOne({_id: id, downvoters: user._id}) !== undefined;
    };

    var upvote = function(collection, id, user) {
        // if no user is specified, use current user by default
        user = (user === undefined) ? Meteor.user() : user;

        if (!user || !canUpvote(user, collection, true) ||
            hasUpvotedItem(user, collection, id))
            return false;

        var votePower = getVotePower(user);
        var vote = 1;

        if (hasDownvotedItem(user, collection, id)) {
            vote += 1;
            votePower *= 2;
        }

        // Votes & Score
        collection.update({_id: id},{
            $addToSet: {upvoters: user._id},
            $pull: {downvoters: user._id},
            $inc: {votes: vote, baseScore: votePower},
            $set: {inactive: false}
        });
        if (!this.isSimulation)
            updateScore(collection, id, true);

        return true;
    };

    var downvote = function(collection, id, user) {
        // if no user is specified, use current user by default
        user = (typeof user === 'undefined') ? Meteor.user() : user;

        if (! user || !canDownvote(user, collection, 'redirect') ||
            hasDownvotedItem(user, collection, id))
            return false;

        var votePower = getVotePower(user);
        var vote = -1;

        if (hasUpvotedItem(user, collection, id)) {
            vote -= 1;
            votePower *= 2;
        }

        // Votes & Score
        collection.update({_id: id},{
            $addToSet: {downvoters: user._id},
            $pull: {upvoters: user._id},
            $inc: {votes: vote, baseScore: -votePower},
            $set: {inactive: false}
        });

        if (!this.isSimulation)
            updateScore(collection, id, true);

        return true;
    };

    var cancelUpvote = function(collection, id, user) {
        // if no user is specified, use current user by default
        user = (typeof user === 'undefined') ? Meteor.user() : user;

        if (! user || !canUpvote(user, collection, 'redirect') || ! hasUpvotedItem(user, collection, id))
            return false;

        var votePower = getVotePower(user);

        // Votes & Score
        collection.update({_id: id},{
            $pull: {upvoters: user._id},
            $inc: {votes: -1, baseScore: -votePower},
            $set: {inactive: false}
        });
        if (!this.isSimulation)
            updateScore(collection, id, true);

        return true;
    };

    var cancelDownvote = function(collection, id, user) {
        // if no user is specified, use current user by default
        user = (typeof user === 'undefined') ? Meteor.user() : user;

        if (! user || !canDownvote(user, collection, 'redirect') || ! hasDownvotedItem(user, collection, id))
            return false;

        var votePower = getVotePower(user);

        // Votes & Score
        collection.update({_id: id},{
            $pull: {downvoters: user._id},
            $inc: {votes: 1, baseScore: votePower},
            $set: {inactive: false}
        });
        if (!this.isSimulation)
            updateScore(collection, id, true);

        return true;
    };

    var getUser = function(user) {
        // only let admins specify different users for voting
        // if no user is specified, use current user by default
        var thisUser = Meteor.user();
        return (isAdmin(thisUser) && user !== undefined) ? user : thisUser;
    };

    Meteor.methods({
        upvotePair: function(pairId, user) {
            user = getUser(user);
            return upvote.call(this, Pairs, pairId, user);
        },
        downvotePair: function(pairId, user) {
            user = getUser(user);
            return downvote.call(this, Pairs, pairId, user);
        },
        cancelUpvotePair: function(pairId, user) {
            user = getUser(user);
            return cancelUpvote.call(this, Pairs, pairId, user);
        },
        cancelDownvotePair: function(pairId, user) {
            user = getUser(user);
            return cancelDownvote.call(this, Pairs, pairId, user);
        },
        updateScores: function() {
            // TODO - make admin only
            Pairs.find({}).forEach(function(x) {
                updateScore(Pairs, x._id, true);
            });
        }
    });

})();
