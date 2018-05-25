
 //Normalized Speech Stream for Waston
 //Intended as a help class to call watson speech with normalized
 //results for Valyant Speech Processor. Each provied will have their
 //own respective class that will all emit the same types of events
 //and generate noramiled responses. 
 
const util = require('util');
const EventEmitter = require('events').EventEmitter;
const keywords = require("./keywords");
const watson = require('watson-developer-cloud');
const NormalizedResponse = require('./normalizedResponse');
const SpeakerStream = require('./speaker-stream');
const watsonUsername = "watson-username-here";
const watsonPassword = "watson-password-here";

const stt_params = {
    continuous: true,
    content_type: "audio/l16;rate=16000",
    speaker_labels: true,
    objectMode: true,
    action: "start",
    interim_results: false,
    profanity_filter: false,
    word_alternatives_threshold: 0.2,
    keywords: keywords,
    keywords_threshold: 0.2,
    inactivity_timeout: 5
};
var stt_params2 = {
    continuous: true,
    content_type: "audio/l16;rate=16000;endianness=little-endian",
    //speaker_labels: true,
    word_alternatives_threshold: 0.2,
    objectMode: true,
    action: "start",
    interim_results: true,
    profanity_filter: false,
    inactivity_timeout: 5,
    keywords: keywords,
    keywords_threshold: 0.2,
    inactivity_timeout: 5
};

class WatsonSpeech {
    constructor(sessionId, speakerLabels = false, debug = true) {
        var self = this;
        self.sessionId = sessionId;
        self.debug = debug;
        self.stt = new watson.SpeechToTextV1({
            "url": "https://stream.watsonplatform.net/speech-to-text/api",
            "username": watsonUsername,
            "password": watsonPassword
        });
        // self.stt_speakerLabels = new watson.SpeechToTextV1({
        //     "url": "https://stream.watsonplatform.net/speech-to-text/api",
        //     "username": watsonUsername,
        //     "password": watsonPassword
        // });
        self.interim_params = stt_params2;
        self.speakerLabels_params = stt_params;
        self.utterenceCount = 0;
        self.sessionWriteStream = "";
        self.writeStream = "";
        //self.recognizeStream = null;
        self.state = "closed";
        //self.startStream();
    }
    startStream() {
        var self = this;
        self.state = "opening";
        // if(self.recognizeStream != null) {
        //     console.log("restarting watson");
        //     try {
        //         var stop = {'action': 'start'};
        //         self.recognizeStream.socket.send(JSON.stringify(start));
        //         }
        //         catch(e) {
        //             return
        //         }
        //     return
        // }
        self.recognizeStream = self.stt.createRecognizeStream(stt_params2);
        
        self.recognizeStream.setEncoding('utf8');
        //self.recognizeStream.on('results', function(event){self.results(event)});
        self.recognizeStream.on('data', function(event){self.data(event)});
        self.recognizeStream.on('error', function(event){self.error(event)});
        self.recognizeStream.on('close', function(event){self.close(event)});
        
        //console.log(self.interim_params);
        

        return self.recognizeStream;
        
    }

    stopStream() {
        var self = this;

        // if(self.state != "open")
        //     return

        try {
            var stop = {'action': 'stop'};
            self.recognizeStream.socket.send(JSON.stringify(stop));
            }
            catch(e) {
                self.state = "closed";
                self.emit("closing", "ws stream already closed");
                console.log("ws stream already closed");
                return
            }
            self.state = "closing";
            self.emit("closing", "closing watson stream");
            return

        if(self.debug)
            console.log("Watson Stream Closing");
    }
    data(event) {
        var self = this;
        self.state = "open";

        if(typeof(event) != "string")
            return

        var utterance = event.trim();
        
        var results = new NormalizedResponse("Watson", utterance, self.writeStream, self.sessionId);
        self.writeStream = results.transcript;
        console.log(results.response);
        self.emit("sttResults", results.response);

    }
    results(event) {
        var self = this;
        self.state = "open";
        console.log("result event emmitted by watson");
    }
    error(event) {
        var self = this;
        self.emit("error", event);

        if(self.debug)
            console.log("Watson Stream Error");
    }
    close(event) {
        var self = this;
        self.state = "closed";
        self.emit('close', event);

        if(self.debug)
            console.log("Watson Stream Closed");
    }
}

util.inherits(WatsonSpeech, EventEmitter);
module.exports = WatsonSpeech;
