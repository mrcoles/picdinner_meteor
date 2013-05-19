
Meteor.methods({
    fixCreated: function() {
        Pairs.find({}).forEach(function(x) {
            if (!/^\d+$/.test(x.created)) {
                var t;
                try {
                    t = (new Date(x.created)).getTime();
                    if (isNaN(t.getTime())) {
                        throw new Error('not a number!');
                    }
                } catch(e) {
                    t = createdNow();
                }
                Pairs.update({_id: x._id}, {$set: {created: t}});
            };
        });
    },
    fixImgur: function() {
        Pairs.find({}).forEach(function(x) {
            var imgur = 'http://imgur.com', img;
            if (x.image.indexOf(imgur) == 0) {
                img = 'http://i.imgur.com' + x.image.slice(imgur.length);
                Pairs.update({_id: x._id}, {$set: {image: img}});
            }
        });
    }
});
