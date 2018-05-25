//speechProcessorSteam

var https = require('https'),
    fs = require('fs'),
    WebSocketServer = require('websocket').server,
    portfinder = require('portfinder'),
    EventEmitter = require('events').EventEmitter,
    util = require('util');

//this is for self-signed ssl created on a unique port for the socket connection
const httpsOptions = {
    key:    fs.readFileSync('ssl/key.pem'),
    cert:   fs.readFileSync('ssl/cert.pem'),
};


class speechProcessorStream {
    constructor(access_token) {
        var self = this;
        self.err = null;
        self.access_token = access_token;
        self.port = null;
        self.wsServer = null;
        self.origin = null;
        self.httpsServer = https.createServer(httpsOptions);
    }
    stream(cb) {
        var self = this;
        portfinder.getPort(function (err, port) {
            if (err) {
                self.err = err;
                self.port = "error";
                cb(err,self);
                return;
            }
            self.port = port;
            self.httpsServer.listen(self.port);
            self.wsServer = new WebSocketServer({
                httpServer: self.httpsServer,
                autoAcceptConnections: false
            });

            self.addOriginListener();
            cb(null, self);
            //return self;
            //add this extra listener here
            
        });
    }
    addOriginListener() {
        var self = this;
        self.wsServer.on('connect', function(webSocketConnection) {
            self.emit('connect', webSocketConnection);
        });

        self.wsServer.on('request', function(request) {
            if (!self.originIsAllowed(request.origin)) {
                // Make sure we only accept requests from an allowed origin
                console.log((new Date()) + ' Connection from origin ' + request.origin + ' rejected.');
                request.reject();
                self.emit('error', ' Connection from origin ' + request.origin + ' rejected.');
            }
            // emit the request so the app calling the module can 
            // listen for the request events on its own
            var connection = request.accept(self.access_token, request.origin);

            console.log((new Date()) + ' Connection accepted.');
            // self.connection = request.accept('echo-protocol', request.origin);

            connection.on('message', function(message) {
                self.emit('message', message);
            });
            connection.on('close', function(reasonCode, description) {
                self.emit('close', reasonCode, description);
            });
            self.connection = connection;
            self.emit('request', request);
        });
    }
    originIsAllowed(origin) {
        // put logic here to detect whether the specified origin is allowed.
        return true;
    }
}


util.inherits(speechProcessorStream, EventEmitter);
module.exports = speechProcessorStream;


