/*
 * ----------------------------------------------------------------------------
 * "THE BEER-WARE LICENSE" (Revision 42):
 * <varga.daniel@gmx.de> wrote this file. As long as you retain this notice you
 * can do whatever you want with this stuff. If we meet some day, and you think
 * this stuff is worth it, you can buy me a beer in return Daniel Varga
 * ----------------------------------------------------------------------------
 */

/**
 * Module dependencies
 */

var express = require('express'),
    https = require('https'),
    http = require('http'),
    path = require('path'),
    fs = require('fs'),
    io = require('socket.io'),
    nconf = require('nconf'),
    logger = require("./lib/xdcclogger"),
    downloadHandler = require("./lib/downloadHandler");

nconf.add('settings', {type: 'file', file: 'config/settings.json'});

nconf.defaults({
    "webserver": {
        "port": 3000,
        "ssl": true,
        "ssl.crt": "ssl/server.crt",
        "ssl.key": "ssl/server.key"
    }
});
nconf.set('webserver',nconf.get('webserver'));
nconf.save();

process.on('SIGINT', function () {
    console.log('Shuting down');
    downloadHandler.exit();
    logger.exit();
    process.exit();
});

nconf.load(function(){

    var routes = require('./routes'),
        api = require('./routes/api');

    var app = module.exports = express();


    /**
     * Configuration
     */

        // all environments
    app.set('port', nconf.get('webserver:port'));
    app.set('views', __dirname + '/views');
    app.set('view engine', 'jade');
    app.use(express.logger('dev'));
    app.use(express.json());
    app.use(express.urlencoded());
    app.use(express.methodOverride());
    app.use(express.static(path.join(__dirname, 'public')));
    app.use(app.router);

    // development only
    if (app.get('env') === 'development'){
        app.use(express.errorHandler());
    }

    // production only
    if (app.get('env') === 'production'){
        // TODO
    }

    /**
     * Routes
     */

    app.get('/', routes.index);
    app.get('/partials/:name', routes.partials);

    // JSON API

    app.get('/api/packet/', api.getNumPackets);

    app.get('/api/packet/get/:id', api.packet);
    app.get('/api/packet/search/:string/', api.packetSearch);
    app.get('/api/packet/search/:string/:page', api.packetSearchPaged);
    app.get('/api/packet/list/', api.packetList);
    app.get('/api/packet/list/:page', api.packetListPaged);

    app.get('/api/packet/sorting/', api.getSorting);
    app.get('/api/packet/filter/', api.getFilter);
    app.get('/api/packet/pagelimit/', api.getPageLimit);

    app.get('/api/server/', api.getServer);

    app.get('/api/db/compacting/', api.getNextCompacting);
    app.get('/api/db/compactingfilter/', api.getCompactingFilter);
    app.get('/api/downloads/', api.getDownloads);
    app.get('/api/downloads/notifications/', api.getDlNotifications);
    app.get('/api/downloads/notifications/count/', api.getDlNotificationCount);

    app.put('/api/packet/sorting/', api.setSorting);
    app.put('/api/packet/filter/', api.setFilter);
    app.put('/api/packet/pagelimit/', api.setPageLimit);
    app.put('/api/db/compacting/', api.compactDb);
    app.put('/api/db/compactingfilter/', api.setCompactngFilter);
    app.put('/api/channel/', api.channels);
    app.put('/api/downloads/upqueue/', api.upQueueDownload);
    app.put('/api/downloads/downqueue/', api.downQueueDownload);
    app.put('/api/downloads/cancel', api.cancelDownload);



    app.post('/api/server/', api.addServer);
    app.post('/api/downloads/', api.startDownload);
    app.post('/api/db/compacting/', api.startCompactCronjob);

    app.delete('/api/server/:key', api.removeServer);
    app.delete('/api/downloads/notifications/', api.clearDlNotifications);
    app.delete('/api/downloads/notifications/count/', api.clearDlNotificationCount);
    app.delete('/api/db/compacting', api.stopCompactCronjob);

    app.get('*', routes.index);




    /**
     * Create server
     */


    fs.readFile(nconf.get('webserver:ssl.key'), function (errorkey, key){
        fs.readFile(nconf.get('webserver:ssl.crt'), function (errorcrt, crt){
            var server;
            if ((errorcrt || errorkey) && nconf.get('webserver:ssl')){
                server = http.createServer(app);
                console.log('No key or cert found, \n!!!Fallback!!! Http');
            }else if(nconf.get('webserver:ssl')){
                server = https.createServer({key: key, cert: crt}, app);
            }else{
                server = http.createServer(app);
            }
            // Hook Socket.io into Express
            io = io.listen(server);

            // Socket.io Communication
            io.sockets.on('connection', require('./routes/socket'));

            /**
             * Start Server
             */

            server.listen(app.get('port'), function (){
                console.log('Server listening on port ' + app.get('port'));
            });
        });
    });

});