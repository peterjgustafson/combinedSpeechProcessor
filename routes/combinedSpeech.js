
 //Combined Speech Stream 
 
const util = require('util');
const stream = require('stream');
const EventEmitter = require('events').EventEmitter;
const natural = require('natural');
const WatsonSpeech = require('./watsonSpeech');
const GoogleSpeech = require('./googleSpeech');

class CombinedSpeech {
    constructor(sessionId, debug = true) {
        var self = this;
        self.sessionId = sessionId;
        self.debug = debug;
        self.watsonSpeech = new WatsonSpeech(self.sessionId);
        self.watsonStream = null;
        self.googleSpeech = new GoogleSpeech(self.sessionId);
        self.googleStream = null;
        self.responseTimeout;
        self.responseTriggered = false;
        self.responseTimeoutComplete = false;
        self.streamTimer;
        self.streamStarted = false;
        self.streamTimeoutMS = 3000;
        self.isListening = false;
        self.googleFinal = null;
        self.watsonFinal = null;
    }
        write(binaryData) {
            var self = this;
            self.watsonStream.write(binaryData);
            //self.googleStream.write(binaryData);
        }
        startStream() {
            var self = this;
            self.watsonStream = self.watsonSpeech.startStream();

            //self.googleStream = self.googleSpeech.startStream();

            console.log(self.googleSpeech.listenerCount('sttResults'))
            if(self.googleSpeech.listenerCount('sttResults') == 0) {
                self.addListeners();
            }
            else {
                self.isListening = true;
            }
            
            self.streamStarted = true;
            self.streamTimout();

            return true;
        }
        addListeners() {
            var self= this;
            self.watsonSpeech.on('sttResults', function(event){self.data(event)});
            self.watsonSpeech.on('close', function(event){self.watsonClose(event)});
            self.googleSpeech.on('sttResults', function(event){self.data(event)});
            self.googleSpeech.on('close', function(event){self.close(event)});
            self.isListening = true;
            self.listenerCount('sttResults')
            return
        }
        stopStream() {
            var self = this;
            try {
                self.googleSpeech.stopStream();
                self.watsonSpeech.stopStream();
            }
            catch(err) {
                if(self.debug)
                    console.log("One of the streams was already closed");
            }
        }
        data(event) {
            console.log("data");
            var self = this;
            
            if(!self.isListening)
                return

            self.state = "open";
            //console.log("results in combined, ", event);
            self.sendFinalResponse(event);

            //clear and restart the timer
            clearInterval(self.streamTimer);
            self.streamTimeoutMS = 3000;
            self.streamTimout();
        }
        watsonClose(event) {
            var self = this;
            
            //self.streamStarted = false;
            self.googleSpeech.stopStream();
        }
        close(event) {
            var self = this;
            console.log("CLOSE EVENT: ", event);
            console.trace();
            self.state = "closed";
            self.emit('close', event);

            if(self.debug)
                console.log("Stream Closing");
        }
        sendFinalResponse(response) {
            var self = this;
            
            if(response.sttSource == "Google" && self.googleFinal == null) {
                self.googleFinal = response;
            }
            else if (self.watsonFinal == null) {
                self.watsonFinal = response;
            }
        
            if(!self.responseTriggered) {
                //we got a second response so return both
                if(self.watsonFinal != null && self.googleFinal != null) {
                    self.finalResponse();
                    return
                }
        
                self.responseTimeout = setTimeout(function(){
                    //we only got one so start the timer and give the second source a chance to respond
                    self.finalResponse();
                    console.trace();

                    if(self.debug)
                            console.log("send time triggered only one provider will be used");
                    return;
                }, 2500);
            }
        }
        finalResponse() {
            var self = this;
            clearTimeout(self.responseTimeout);
            //use a set timeout here to and group the responses
            //into a single final response to send.
            self.responseTriggered = true;
            self.responseTimeoutComplete = false;
        
            var unifiedResponse = {};
            //unifiedResponse.associatedRecording = associatedRecording + ".wav";
            unifiedResponse.sources = [];
            unifiedResponse.responseCount = 0;
            if(self.watsonFinal == null || self.googleFinal == null) {
                //only one response made it find out which one
                if(self.googleFinal == null) {
                    //google didn't make the cutoff
                    unifiedResponse.responseCount ++;
                    unifiedResponse.sources.push(self.watsonFinal);
                }
                else {
                    //watson didn't make the cutoff
                    unifiedResponse.responseCount ++;
                    unifiedResponse.sources.push(self.googleFinal);
                }
            }
            else {
                unifiedResponse.sources.push(self.watsonFinal);
                unifiedResponse.sources.push(self.googleFinal);
                unifiedResponse.responseCount = 2;
            }
        
            if(self.debug) {
                console.log("watsonFinal: ", self.watsonFinal);
                console.log("googleFinal: ", self.googleFinal);
                console.log(unifiedResponse);

            if(unifiedResponse.sources.length == 0 || unifiedResponse.sources[0] == null)
                return
        
            if(self.googleFinal != null && self.watsonFinal != null)
                unifiedResponse.levenshteinDistance = natural.LevenshteinDistance(self.watsonFinal.lastUtterence, self.googleFinal.lastUtterence);
            
        
            unifiedResponse.sources.sort(function (a, b) {
                return b.orderScore - a.orderScore;
            });
        
                //console.log(unifiedResponse.sources);
            }
            
            // fileWriter.end();
            // saveRecording(associatedRecording, JSON.stringify(unifiedResponse, null, 4));
            // writefile();
            console.log("emmitting results");
            //console.trace();
            self.emit("unifiedResults", unifiedResponse);
            //client.sendUTF(JSON.stringify(unifiedResponse));

            //reset all the variables used in the order combination process
            self.watsonFinal = null;
            self.googleFinal = null;
            self.responseTriggered = false;
            self.responseTimeoutComplete = false;
        
        }
        streamTimout() {
            var self = this;
            //console.log("timer started:", self.streamTimer)
            self.streamTimer = setInterval(function(){
                    console.log("timer activated:", "streamStarted:", self.streamStarted)
                    
                    // try {
                        self.emit("timeout", "Timeout limit of " + self.streamTimeoutMS + "ms has been exceeded with no speech.");
                        self.stopStream();
                        self.streamStarted = false;
                        clearInterval(self.streamTimer);
                    // }
                    //     catch(error) {
                    //         if(self.debug)
                    //             console.log("client already terminated");
                    //     };
                } , self.streamTimeoutMS);
        }
}

util.inherits(CombinedSpeech, EventEmitter);
module.exports = CombinedSpeech;