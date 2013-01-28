
/**
 * Module dependencies.
 */

var express = require('express')
  , routes = require('./routes')
  , user = require('./routes/user')
  , http = require('http')
  , path = require('path')
  , conf = require('./conf')
  , mongoose = require('mongoose')
  , Schema = mongoose.Schema
  , ObjectId = mongoose.SchemaTypes.ObjectId
  , passport = require('passport')
  , FacebookStrategy = require('passport-facebook').Strategy

var UserSchema = new Schema({
  provider: String,
  uid: String,
  username: String,
  name: String,
  first_name: String,
  last_name: String,
  link: String,
  image: String,
  marker_id: Number,
  created: {type: Date, default: Date.now}
});
mongoose.model('User', UserSchema);

var MarkerSchema = new Schema({
  marker_id: Number,
  marker: String,
  occupied: Boolean
});
mongoose.model('Marker', MarkerSchema);

mongoose.connect('mongodb://localhost/suzuri');

var User = mongoose.model('User');
var Marker = mongoose.model('Marker');

var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function callback () {
  console.log('Connected to DB');
});

passport.use(new FacebookStrategy({
    clientID: conf.fb.appId,
    clientSecret: conf.fb.appSecret,
    callbackURL: "http://10.0.2.1:3000/auth/facebook/callback"
  },
  function(accessToken, refreshToken, profile, done) {
    //console.log(profile);
    User.findOne({uid: profile.id}, function(err, user) {
      if(user) {
        done(null, user);
      } else {
        Marker.findOneAndUpdate({occupied: false}, {occupied: true}, function(err, marker){
          var user = new User();
          user.provider = "facebook";
          user.uid = profile.id;
          user.username = profile._json.username;
          user.name = profile._json.name;
          user.first_name = profile._json.first_name;
          user.last_name = profile._json.last_name;
          user.link = profile._json.link;
          user.image = 'https://graph.facebook.com/' + user.username + '/picture';
          user.marker_id = marker.marker_id;
          user.save(function(err) {
            if(err) { throw err; }
            done(null, user);
          });
        });
      }
    })
  }
));

passport.serializeUser(function(user, done) {
  done(null, user.uid);
});

passport.deserializeUser(function(uid, done) {
  User.findOne({uid: uid}, function (err, user) {
    done(err, user);
  });
});

var app = express();

app.configure(function(){
  app.set('port', process.env.PORT || 3000);
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.favicon());
  app.use(express.logger('dev'));
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(express.cookieParser());
  app.use(express.session({secret: 'secret'}));
  app.use(passport.initialize());
  app.use(passport.session());
  app.use(app.router);
  app.use(express.static(path.join(__dirname, 'public')));
});

app.configure('development', function(){
  app.use(express.errorHandler());
});

app.get('/', routes.index);
app.get('/users', user.list);

app.get('/auth/facebook',
  passport.authenticate('facebook'),
  function(req, res){
    // The request will be redirected to Twitter for authentication, so this
    // function will not be called.
  });

app.get('/auth/facebook/callback', 
  passport.authenticate('facebook', { failureRedirect: '/login' }),
  function(req, res) {
    res.redirect('/');
  });

app.get('/logout', function(req, res){
  req.logout();
  res.redirect('/');
});

function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) { return next(); }
  res.redirect('/')
}

http.createServer(app).listen(app.get('port'), function(){
  console.log("Express server listening on port " + app.get('port'));
});
