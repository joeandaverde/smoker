var express = require('express');
var app = express();
var http_server = require('http').createServer(app);
var io = require('socket.io').listen(http_server, { log: true });
var config = require('./config');
var Smoker = require('./lib/smoker');
var logger = require('winston');

logger.info('NODE_ENV: ' + process.env.NODE_ENV);

app.configure(function () {
   app.set('port', process.env.PORT || 3000);
   app.set('io', io);
   app.set('views', __dirname + '/views');
   app.set('view engine', 'jade');
   app.use(express.static(__dirname + '/public/'));
   app.use(express.static(__dirname + '/bower_components/'));
   app.use(require('connect-assets')({
      helperContext: app.locals,
      paths: ['public/css']
   }));
});

var smoker = new Smoker(config);

smoker.start()
.then(function () {
   logger.info('start complete');
   app.set('smoker', smoker);
   app.set('config', config);
   require('./routes/index')(app);
   logger.info('Starting http server on port %d', app.get('port'));
   http_server.listen(app.get('port'));
   logger.info('Server listening on port %d', app.get('port'));
})
.fail(function (e) {
   logger.error('Unable to start smoker', e);
});
