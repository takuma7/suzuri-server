
/**
 * Module dependencies.
 */

var express = require('express')
  , routes = require('./routes')
  , user = require('./routes/user')
  , http = require('http')
  , path = require('path')
  , conf = require('./conf')
  , app = express()
  , server = http.createServer(app)
  , mongoose = require('mongoose')
  , Schema = mongoose.Schema
  , ObjectId = mongoose.SchemaTypes.ObjectId
  , passport = require('passport')
  , FacebookStrategy = require('passport-facebook').Strategy
  , io = require('socket.io').listen(server)
  , osc = require('node-osc');

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
  marker: String,
  suzuri: {
    color: String,
    size: Number,
  },
  created: {type: Date, default: Date.now}
});
mongoose.model('User', UserSchema);

var MarkerSchema = new Schema({
  marker_id: Number,
  marker: String,
  occupied: Boolean
});
mongoose.model('Marker', MarkerSchema);

mongoose.connect(conf.db.mongo.protocol + '://' + conf.db.mongo.host + '/' + conf.db.mongo.db_name);

var User = mongoose.model('User');
var Marker = mongoose.model('Marker');

var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function callback () {
  console.log('Connected to DB');
});

passport.use(new FacebookStrategy({
    clientID: conf.auth.fb.appId,
    clientSecret: conf.auth.fb.appSecret,
    callbackURL: conf.baseURL + "/auth/facebook/callback"
  },
  function(accessToken, refreshToken, profile, done) {
    //console.log(profile);
    User.findOne({uid: String(profile.id)}, function(err, user) {
      if(user) {
        done(null, user);
      } else {
        Marker.findOneAndUpdate({occupied: false}, {occupied: true}, function(err, marker){
          var user = new User();
          user.provider = "facebook";
          user.uid = profile.id;
          user.username = profile._json.username;
          if(user.username == undefined){
            user.username == "undefined"
          }
          user.name = profile._json.name;
          user.first_name = profile._json.first_name;
          user.last_name = profile._json.last_name;
          user.link = profile._json.link;
          http.get({
            host: 'graph.facebook.com',
            path: '/' + user.uid + '/picture?redirect=false'
          },function(res){
            var str = "";
            res.on('data', function(chunk){
              str += chunk;
            });
            res.on('end', function(){
              var img_data = JSON.parse(str);
              console.log(img_data);
              if(img_data.data){
                user.image = img_data.data.url;
              }else{
                user.image = conf.baseURL + '/images/default.gif';
              }
              user.marker_id = marker.marker_id;
              user.marker = marker.marker;
              user.suzuri.color = conf.suzuri_settings.color;
              user.suzuri.size = conf.suzuri_settings.size;
              user.save(function(err) {
                if(err) { throw err; }
                done(null, user);
              });
            });
          }).on('error', function(err){
            console.log('Got error: ' + err.message);
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

app.configure(function(){
  app.set('port', process.env.PORT || 3000);
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.favicon(__dirname + '/public/images/favicon.ico'));
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

app.get('/', function(req, res){
  res.render('index',{
    title: 'Suzuri',
    user: req.user,
    conf: conf
  });
});
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

server.listen(app.get('port'), function(){
  console.log("Express server listening on port " + app.get('port'));
});

/* */
var trackedMarkers = [];

/* osc */
var oscReceiver = new osc.Server(conf.osc.receiver.port, conf.osc.receiver.host);
var oscSender = new osc.Client(conf.osc.sender.host, conf.osc.sender.port);

oscReceiver.on('message', function(msg, rinfo){
  console.log(msg);
  var address = msg[2][0];
  var args = msg[2].slice(1);
  console.log("address: " + address + "\nargs:" + args.toString());
  switch(address){
    case '/camera/marker/tracked':
      io.sockets.emit('marker tracked', {
        marker_id: args[0],
      });
      if(trackedMarkers.indexOf(args[0]) == -1){
        trackedMarkers.push(args[0]);
      }
      break;
    case '/camera/marker/lost':
      io.sockets.emit('marker lost', {
        marker_id: args[0],
      });
      if(trackedMarkers.indexOf(args[0]) != -1){
        var pos = trackedMarkers.indexOf(args[0]);
        trackedMarkers.splice(pos, 1);
      }
      break;
    case '/camera/hand/tracked':
      io.sockets.emit('hand tracked', {
        uid: args[0],
        trackedHandsNum: args[1],
      });
      break;
    case '/camera/hand/lost':
      io.sockets.emit('hand lost', {
        uid: args[0],
        trackedHandsNum: args[1],
      });
      break;
    case '/user/info':
      User.findOne({uid: args[0]}, function(err, user){
        if(user){
          oscSender.send('/user/info', user.uid, "user.username", user.first_name, user.last_name, user.image, user.link, user.suzuri.size, user.suzuri.color);
        }else{
          oscSender.send('/user/info', -1);
        }
      });
      break;
  }
});

/* socket.io */

io.sockets.on('connection', function (socket) {
  socket.on('marker tracked?', function(data){
    if(trackedMarkers.indexOf(data.marker_id) != -1){
      socket.emit('marker tracking status', {
        marker_id: data.marker_id,
        tracked: true,
      });
    }else{
      socket.emit('marker tracking status', {
        marker_id: data.marker_id,
        tracked: false,
      });
    }
  });
  socket.on('tap', function(data){
    console.log(data);
    oscSender.send('/client/tap', data.marker_id, data.uid);
  });
  socket.on('suzuri color changed', function(data){
    console.log(data);
    oscSender.send('/suzuri/color/changed', data.uid, data.color);
  });
  socket.on('suzuri size changed', function(data){
    console.log(data);
    oscSender.send('/suzuri/size/changed', data.uid, data.size);
  });
  socket.on('suzuri type changed', function(data){
    console.log(data);
    oscSender.send('/suzuri/type/changed')
  });
});
