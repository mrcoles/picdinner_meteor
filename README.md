
PicDinner: a Meteor app that pairs up images and audio
======================================================

[PicDinner](http://picdinner.com) breaks down your usual video experience and builds it back up as a delicious visual and aural meal of an image plus a sound file. Sample [existing picDinners](http://picdinner.com/b0150005-323b-453c-88e2-8d92a6f1e9cf) or pair up your own and share them with your friends.

PicDinner was my first forray into building something with [Meteor](http://meteor.com), and it was a pretty neat-o experience. The ease of building reactive documents is great, but zero effort for an environment, a db, and server is pretty amazing too.

### Technical mumbo-jumbo:

It’s a pretty straight-forward app (I wrote it on Meteor 0.5.2), some non-standard things in there might be:

*   renamed my core files to index.html, app.js, style.less (included less package)
*   used History.js for HTML5 pushState and semi-manual URL routing
*   wrote some relatively reusable code for including FB & Twitter sharing widgets
    that lives in client/shares*

Some ideas that eluded me when I first started:

*   it’s a single-page app and every file gets merged into that one page, and the server will load that page on any URL path that you hit
*   the html files have essentially 3 top-level sections (that can be repeated): head, body, template
*   run `meteor add less` and .less files will just work
*   use the [Session](http://docs.meteor.com/#session) object with Template helpers for “reactivity”
*   use [allow](http://docs.meteor.com/#allow) and separately [publish](http://docs.meteor.com/#meteor_publish)/[subscribe](http://docs.meteor.com/#meteor_subscribe) to limit the data
*   [create a pasword](http://docs.meteor.com/#meteordeploy) when you deploy your app (subject to change in the future)

Some pain-points, possibly due to being new to Meteor:

*   wanted to re-use the same template in different templates
    with different helper function variables, I ended up making
    multiple templates as seen in client/shares.html
*   had to fall back to Tempate.foo.rendered for more advanced JS
    interaction like the music playing and updating the share buttons
*   my CPU goes nuts when I run the application, but that’s probably
    just because I’m currently playing up to 10 animated gifs at once
