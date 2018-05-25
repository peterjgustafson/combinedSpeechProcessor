
 //Normalized Speech Stream for Google
 //Intended to call Google speech with normalized
 //results for Valyant Speech Processor. Each provied will have their
 //own respective class that will all emit the same types of events
 //and generate noramiled responses. 
 
const util = require('util');
const EventEmitter = require('events').EventEmitter;
const keywords = require("./keywords");
var googleSpeech = require('@google-cloud/speech');
const NormalizedResponse = require('./normalizedResponse');
const encoding = 'LINEAR16';
const sampleRateHertz = 16000;
const languageCode = 'en-US';
const googleRequest = {
    config: {
        encoding: encoding,
        sampleRateHertz: sampleRateHertz,
        languageCode: languageCode
    },
    interimResults: false,
    singleUtterance: false
};


class GoogleSpeech {
    constructor(sessionId, debug = true) {
        var self = this;
        self.sessionId = sessionId;
        self.stt = googleSpeech({
            projectId: 'AIH-Speaker-Identifier',
            keyFilename: './AIH-Speaker-Identifier-729e234a463b.json',
            speech_contexts: keywords
        });
        self.params = googleRequest;
        self.stopOnNextResult = false;
        self.utterenceCount = 0;
        self.sessionWriteStream = "";
        self.writeStream = "";
        self.state = "closed";
        self.debug = debug;
        //self.startStream();
    }
    startStream() {
        var self = this;
        console.log("google start");
        self.state = "opening";
        self.recognizeStream = self.stt.streamingRecognize(googleRequest)
        .on('error', function(event){self.error(event)})
        .on('close', function(event){self.close(event)})
        .on('data', function(event){self.data(event)});

        self.stopOnNextResult = false;

        return self.recognizeStream;
        
    }
    stopStream() {
        var self = this;

        // if(self.state != "open")
        //     return

            self.stopOnNextResultGoogle = true;
            self.state = "closing";
            self.emit("closing", "closing google stream");
            return

        if(self.debug)
            console.log("Google Stream Closing");
    }
    data(event) {
        var self = this;
        console.log("GOOGLE");
        if(event.speechEventType == "END_OF_SINGLE_UTTERANCE") {

        }
        console.log("speechEventType: ", event.speechEventType);
        console.log(JSON.stringify(event));
        if(event.error != null || typeof(event.results) == "undefined" || event.results.length == 0)
            return

            
        self.state = "open";
        if(event.results[0].isFinal) {
            var utterance = event.results[0].alternatives[0].transcript.trim();
        
            var results = new NormalizedResponse("Google", utterance, self.writeStream, self.sessionId);
            self.writeStream = results.transcript;
            console.log("gResult", JSON.stringify(results.response, null, 4));
            self.emit("sttResults", results.response);
        }
        if(self.stopOnNextResult) {
            self.recognizeStream.end();
        }

    }
    results(event) {
        var self = this;
        self.state = "open";

    }
    error(event) {
        var self = this;
        self.emit("error", event);

        if(self.debug)
            console.log("Google Stream Error");
    }
    close(event) {
        var self = this;
        self.state = "closed";
        self.emit('close', event);

        if(self.debug)
            console.log("Google Stream Closed");
    }
}

util.inherits(GoogleSpeech, EventEmitter);
module.exports = GoogleSpeech;