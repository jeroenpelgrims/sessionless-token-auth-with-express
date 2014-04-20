var express = require('express');
var passport = require('passport');
var mongoose = require('mongoose');
var BearerStrategy = require('passport-http-bearer').Strategy
var FacebookStrategy = require('passport-facebook').Strategy

var app = express();
app.configure(function() {
    //DB config
    mongoose.connect('mongodb://localhost/exampledb');

    var UserSchema = new mongoose.Schema({
        facebookId: {
            type: String
        },
        access_token: {
            type: String
        },
    });

    UserSchema.statics.findOrCreate = function(filters, cb) {
        User = this;
        this.find(filters, function(err, results) {
            if(results.length == 0) {
                var newUser = new User();
                newUser.facebookId = filters.facebookId;
                newUser.save(function(err, doc) {
                    cb(err, doc)
                });
            } else {
                cb(err, results[0]);
            }
        });
    };

    var User = mongoose.model('User', UserSchema);

    //facebook auth setup
    options = {
        clientID: process.env.FACEBOOK_APP_ID,
        clientSecret: process.env.FACEBOOK_APP_SECRET,
        callbackURL: 'http://localhost:3000/auth/facebook/callback'
    };

    passport.use(
        new FacebookStrategy(
            options,
            function(accessToken, refreshToken, profile, done) {
                User.findOrCreate(
                    { facebookId: profile.id },
                    function (err, result) {
                        if(result) {
                            result.access_token = accessToken;
                            result.save(function(err, doc) {
                                done(err, doc);
                            });
                        } else {
                            done(err, result);
                        }
                    }
                );
            }
        )
    );

    app.get(
        '/auth/facebook',
        passport.authenticate('facebook', { session: false, scope: [] })
    );

    app.get('/auth/facebook/callback',
        passport.authenticate('facebook', { session: false, failureRedirect: "/" }),
        function(req, res) {
            res.redirect("/profile?access_token=" + req.user.access_token);
        }
    );

    //token auth setup
    passport.use(
        new BearerStrategy(
            function(token, done) {
                User.findOne({ access_token: token },
                    function(err, user) {
                        if(err) {
                            return done(err)
                        }
                        if(!user) {
                            return done(null, false)
                        }

                        return done(null, user, { scope: 'all' })
                    }
                );
            }
        )
    );
});


app.get(
    '/',
    function(req, res) {
        res.send('<a href="/auth/facebook">Log in</a>');
    }
);

app.get(
    '/profile',
    passport.authenticate('bearer', { session: false }),
    function(req, res) {
        res.send("LOGGED IN as " + req.user.facebookId + " - <a href=\"/logout\">Log out</a>");
    }
);


app.listen(3000);