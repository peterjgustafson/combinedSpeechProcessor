var express = require('express');
var router = express.Router();

var https = require('https'),
        AWS = require('aws-sdk'),
        fs = require('fs'),
        wav = require('wav'),
        connect = require('connect'),
        watson = require('watson-developer-cloud'),
        SpeakerStream = require('./speaker-stream'),
        WebSocket = require('websocket').w3cwebsocket,
        Url = require('url'),
        portfinder = require('portfinder'),
        utterance = require('./utterance').Utterance;

AWS.config.update({
    accessKeyId: "AKIAIX4Q624QEC4JLARQ",
    secretAccessKey: "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",
    region: 'us-west-2'
});  

var utterenceCount = 0;

var httpsServer;
var server;
var clientPort;
var clientId;
var sessionId;
var spl = require("./speechProcessorStream");
var CombinedSpeech = require("./combinedSpeech");
var SPL;

var fileWriter = null;
var fileName = null;
var associatedRecording = null;

router.get('/', function(req, res, next) {

    sessionId = req.query.access_token || 'spl-stream';
    var combinedSpeech = new CombinedSpeech(sessionId);
    var listenersAdded = false;
    var recognizeStream = {};
    recognizeStream.streamStarted = false;

    //create a temp directory for recordings if there already isn't one
    if(!fs.existsSync("recordings"))
        fs.mkdirSync("recordings");

    SPL = new spl(sessionId);
    var wsConnection;
    SPL.stream(function(err,stream){

        //console.log(SPL);
        res.type('json');
        res.send({ sessionId: sessionId, port: SPL.port });
    
        
        SPL.on('connect', function(webSocketConnection) {
            console.log("new connection...");
            wsConnection = webSocketConnection;
        });
        SPL.on('request', function(request) {
            
            //i don't check for origin here because I already do
            //in the custom class that is emmitting the events
            //var connection = SPL.connection;

            SPL.on('message', function(message) {
                if(combinedSpeech.streamStarted == false) {
                    recognizeStreams = combinedSpeech.startStream();
                    if(!listenersAdded) {
                        combinedSpeech.on("unifiedResults", function(event) {onSttResponse(event, wsConnection)});
                    }
                    // recognizeStreams.forEach(function(speechToTextProviderStream) {
                    //     console.log(speechToTextProviderStream);
                        
                    //   });
                    console.log('stream start');
                    writefile();

                }
                if (message.type === 'utf8') {
                    //console.log('Received Message: ' + message.utf8Data);
                    //connection.sendUTF(message.utf8Data);
                }
                else if (message.type === 'binary') {
                    //console.log("stream started? ... ", combinedSpeech.streamStarted);
                    // recognizeStreams.forEach(function(speechToTextProviderStream) {
                    //     speechToTextProviderStream.write(message.binaryData);
                    //   });
                    combinedSpeech.write(message.binaryData);
                    fileWriter.write(message.binaryData);
                    
                }
            });
            SPL.on('close', function(reasonCode, description) {
                combinedSpeech.stopStream();
                console.log("Connection Closed");

            });
        });
        
    });

});
function addListeners() {
    
}
var serverTimer;
function serverTimeout() {
    self = this;
    //console.log("timer started:", streamTimer)
    
    serverTimer = setInterval(function(){
        if(typeof(httpsServer) != 'undefined')
            httpsServer.close();
        clearInterval(serverTimer)
        if(typeof(server) != 'undefined')
            server.close();
        } , 300000);
}

function onSttResponse(event, client) {
    //console.log(fileWriter);
    fileWriter.end();
    saveRecording(associatedRecording, JSON.stringify(event, null, 4));
    writefile();
    console.log(JSON.stringify(event));
}
function onSttTimeout(event, client) {
    
}
function onSttClose(event, client) {

}
function writefile() {
    //add support for recording = 
    associatedRecording = sessionId +"_"+ new Date().getTime();
    fileName = "recordings/"+ associatedRecording;
    fileWriter = new wav.FileWriter(fileName + ".wav", {
        channels: 1,
        sampleRate: 16000,
        bitDepth: 16 });
}
var s3 = new AWS.S3();
function saveRecording (filepath, response) {
    var self = this;

    var bucket = "speechprocessor-audio-audit";
    var filePath = "./recordings/" + associatedRecording + ".wav";

    fs.readFile(filePath, function (err, data) {
        if (err) { throw err; }

        var base64data = new Buffer(data, 'binary');

        var s3 = new AWS.S3();
        s3.putObject({
            Bucket: bucket,
            Key: filepath + '.wav',
            Body: base64data,
            ACL: 'public-read',
            ContentType: 'audio/wav'
        },function (resp) {
            fs.unlink(filePath)
            console.log(arguments);
            console.log('Successfully uploaded wav. ' + associatedRecording + ".wav");

            s3.putObject({
                Bucket: bucket,
                Key: filepath + '.json',
                Body: response,
                ACL: 'public-read',
            },function (resp) {
                console.log(arguments);
                console.log('Successfully uploaded json.' + associatedRecording + ".json");
            });

        });

    });
    //this will be the unique client id associated with user.
    // We first check their face to see if we already have their face indexed in Rekognition
    


        // var data = new Buffer(file.buffer, 'binary');

        
        // var params = {Bucket: bucket, Key: associatedRecording + ".wav", Body: data, ACL: 'public-read', ContentType: 'audio/wav'};
        

        // s3.putObject(params, function(err, data) {
        //     if (err) {
        //         console.log("S3 Error: ", err)
        //     }
        //     else {
        //         //console.log(data);
        //         console.log("Successfully uploaded data to " + params);
        //     }
        // });


}
module.exports = router;
