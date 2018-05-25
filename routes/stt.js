var express = require('express');
var router = express.Router();
var stream = require('stream');

 var https = require('https'),
        AWS = require('aws-sdk'),
        fs = require('fs'),
        wav = require('wav'),
        connect = require('connect'),
        UAParser = require('./ua-parser'),
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

var natural = require('natural');

var uuid = require('node-uuid');

const keywords = require("./keywords");


const nlu = new watson.NaturalLanguageUnderstandingV1({
    "url": "https://gateway.watsonplatform.net/natural-language-understanding/api",
    "username": "470ee6ba-adcb-4c4d-9125-42aec261cd44",
    "password": "bv0C5gJEz2lx",
    "version_date": "2017-02-27"
  });

        var stt_params = {
            continuous: true,
            content_type: "audio/l16;rate=16000;endianness=little-endian",
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

        var recognizeStream = null;
        var recognizeStreamInterim = null;
        const googleSpeech = require('@google-cloud/speech');
        
        
        
          // The encoding of the audio file, e.g. 'LINEAR16'
          const encoding = 'LINEAR16';
        
          // The sample rate of the audio file in hertz, e.g. 16000
          const sampleRateHertz = 16000;
        
          // The BCP-47 language code to use, e.g. 'en-US'
          const languageCode = 'en-US';
        
          

 var uaParser = new UAParser();

var options = {
    key:    fs.readFileSync('ssl/key.pem'),
    cert:   fs.readFileSync('ssl/cert.pem'),
};

var timeoutMS = 3000;
var utterenceCount = 0;



var readStream = new stream();
var sessionWriteStream = "";
var writeStream = "";

var sessionWriteStreamGoogle = "";
var writeStreamGoogle = "";
var lastUtteranceGoogle = "";
var stopOnNextResultGoogle = false;
var streamTimer;
var streamStarted = false;

var httpsServer;
var server;
var clientPort;
var clientId;
var sessionId;
var spl = require("./speechProcessorStream.js");
var SPL;

var fileWriter = null;
var fileName = null;
var associatedRecording = null;

router.get('/', function(req, res, next) {

    sessionId = req.query.access_token || 'spl-stream';
    //create a temp directory for recordings
    if(!fs.existsSync("recordings"))
        fs.mkdirSync("recordings");
        
        const speech_to_textGoogle = googleSpeech({
            projectId: 'AIH-Speaker-Identifier',
            keyFilename: './AIH-Speaker-Identifier-729e234a463b.json',
            speech_contexts: keywords
        });
        const speech_to_text = new watson.SpeechToTextV1({
            "url": "https://stream.watsonplatform.net/speech-to-text/api",
            "username": "85228eb7-fcf6-4a8b-852b-dbacd73904ae",
            "password": "SvwquH2lrF4s"
        });
        const speech_to_text2 = new watson.SpeechToTextV1({
            "url": "https://stream.watsonplatform.net/speech-to-text/api",
            "username": "85228eb7-fcf6-4a8b-852b-dbacd73904ae",
            "password": "SvwquH2lrF4s"
        });
        const googleRequest = {
            config: {
                encoding: encoding,
                sampleRateHertz: sampleRateHertz,
                languageCode: languageCode
            },
            interimResults: false
        };

    SPL = new spl(sessionId);
    var wsConnection;
    SPL.stream(function(err,stream){

        //console.log(SPL);
        res.type('json');
        res.send({ sessionId: sessionId, port: SPL.port });
    
        
        SPL.on('connect', function(webSocketConnection) {
            console.log("new connection...");
            //clearInterval(streamTimer);
            timeoutMS = 6000;
            utterenceCount = 0;
            //console.log(webSocketConnection);
            
            console.log(SPL);
            wsConnection = webSocketConnection;
            
        });
        SPL.on('request', function(request) {
            
            //i don't check for origin here because I already do
            //in the custom class that is emmitting the events
            //var connection = SPL.connection;

            SPL.on('message', function(message) {
                if(streamStarted == false) {
                    //recognizeStream = setupStream(speech_to_text, stt_params, wsConnection);
                    recognizeStreamInterim = setupInterimStream(speech_to_text2, stt_params2, wsConnection);
                    
                    googleRecognizeStream = setupGoogleStream(speech_to_textGoogle, googleRequest, wsConnection);
                    console.log(googleRecognizeStream);
                    return
                    writeStream = "";
                    writeStreamGoogle = "";
                    writeStreamGoogleFinal = "";
                    sessionWriteStream = "";
                    console.log('stream start');
                    streamStarted = true;
                    clearInterval(streamTimer);
                    streamTimout(SPL.connection);

                    writefile()

                }
                if (message.type === 'utf8') {
                    console.log('Received Message: ' + message.utf8Data);
                    //connection.sendUTF(message.utf8Data);
                }
                else if (message.type === 'binary') {
                    //recognizeStream.write(message.binaryData);
                    recognizeStreamInterim.write(message.binaryData);
                    googleRecognizeStream.write(message.binaryData);
                    fileWriter.write(message.binaryData);
                    
                }
            });
            SPL.on('close', function(reasonCode, description) {

                //finish the audio recording then send it to s3
                // if ( fileWriter != null ) {
                //     console.log("fileWriter: ", fileWriter);
                //     fileWriter.end();
                // }
                console.log("Connection Closed");
                clearInterval(streamTimer);
                setTimeout(function() {
                if(!streamStarted)
                    return
        
                stopOnNextResultGoogle = true;
                stopStream(recognizeStreamInterim, stt_params2, speech_to_text2);
                //stopStream(recognizeStream, stt_params, speech_to_text);
                streamStarted = false;
                } , 2000);
        

            });
        });
        
    });

});

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
function streamTimout(client) {
    self = this;
    //console.log("timer started:", streamTimer)
    streamTimer = setInterval(function(){
            console.log("timer activated:", "streamStarted:", streamStarted)
            

            try {
            stopStream(recognizeStreamInterim, stt_params2, speech_to_text2);
            client.sendUTF(JSON.stringify({message: "speech_ended"}));
            stopStream(recognizeStream, stt_params, speech_to_text);
            googleRecognizeStream.end();
            streamStarted = false;
            //finish the audio recording then send it to s3
            // if ( fileWriter != null ) {
            //     saveRecording(fileWriter, lastResponse);
            // }
            clearInterval(streamTimer);
            }
                catch(error) {
                    console.log("client already terminated");
                };
        } , timeoutMS);
}
function setupGoogleStream(sttObj, request, client) {
    console.log("setup stream");
    var googleStream = sttObj.streamingRecognize(request)
        .on('error', function(event) { onGoogleEvent('Error:', event, client, sttObj); })
        .on('close', function(event) { onGoogleEvent('Close:', event, client, sttObj); })
        .on('data', function(event) { onGoogleEvent('Data:', event, client, sttObj); });
    
    stopOnNextResultGoogle = false;

    return googleStream
}
function setupStream(sttObj, sttParams, client) {
        console.log("setup stream");
        var watsonStream = sttObj.createRecognizeStream(sttParams);

        watsonStream.setEncoding('utf8');

        watsonStream.on('error', function(event) { onEvent('Error:', event, client); });
        watsonStream.on('close', function(event) { onEvent('Close:', event, client); });
        watsonStream.on('speaker_labels', function(event) { onEvent('Speaker_Labels:', event, client); });

        return watsonStream
}
function setupInterimStream(sttObj, sttParams, client) {
        console.log("setup inerim stream");

        var watsonStream = sttObj.createRecognizeStream(sttParams);

        watsonStream.setEncoding('utf8');

        watsonStream.on('results', function(event) { onInterimEvent('Results:', event, client); });
        watsonStream.on('data', function(event) { onInterimEvent('Data:', event, client); });
        watsonStream.on('error', function(event) { onInterimEvent('Error:', event, client); });
        watsonStream.on('close', function(event) { onInterimEvent('Close:', event, client); });
        //watsonStream.on('speaker_labels', function(event) { onInterimEvent('Speaker_Labels:', event, client); });
        
        return watsonStream
}
function stopStream(watsonStream, params, sttObj) {
        if(!streamStarted)
            return

        try {
        var stop = {'action': 'stop'};
        watsonStream.socket.send(JSON.stringify(stop));
        }
        catch(e) {
            console.log("ws stream already closed");
        }
        return
}
function stopStreamGoogle(watsonStream, params, sttObj) {
    if(!streamStarted)
        return

    
        stopOnNextResultGoogle = true;

    return
}
function onEvent(name, event, client) {
    //console.log(name);

    if(typeof(event) == "object")
        //console.log(event);
    var returnText;
    
    if(name = "Speaker_Labels:") {
        if(typeof(event.speaker_labels) == "object" && typeof(event.results) == "object") {
            console.log("final result");

            var speakerStream = new SpeakerStream();
            speakerStream.results = event.results;

            speakerStream.speaker_labels = event.speaker_labels;


            
            var returnResults = {};
            var extendedResults = {};
            returnResults.sessionId = sessionId;
            var speakersOutput = [];
            try {
            var speakerData = speakerStream.buildMessage();
            console.log(speakerData);
            var edititedTranscript = "";
             for(var result = 0; result < speakerData.results.length; result++) {
                var keywords = []; 
                if (speakerData.results[result].keywords_result) {
                     keywords = Object.keys(speakerData.results[result].keywords_result);
                    //  for(var keyword = 0; keyword < keywords.length; keyword++) {
                    //     console.log(keywords[keyword])
                    // }
                    
                 }
                speakersOutput.push({"speaker": speakerData.results[result].speaker, "text": speakerData.results[result].alternatives[0].transcript, "keyword_result": keywords});
                if(result != 0)
                    edititedTranscript += " ";

                edititedTranscript += speakerData.results[result].alternatives[0].transcript;
                 
            }


            returnResults.sttSource = "Watson";
            returnResults.resultsType = "final";
            returnResults.speakerData = speakersOutput;
            returnResults.transcript = edititedTranscript;

            //this is the levenstain distance between the two transcripts
            returnResults.comparisonScore = natural.LevenshteinDistance(edititedTranscript, writeStreamGoogle)
            //here is one set of final results
            //I don't want to send them right away
            writeStream = "";
            writeStreamGoogle = "";
            writeStreamGoogleFinal = "";
            sessionWriteStream = "";
            //clearInterval(streamTimer);
            //clearInterval(serverTimer);
            serverTimeout();
            
            var responseToSend = JSON.stringify({sttSource: "Watson", 
            sessionId: sessionId, 
            lastUtterence: watsonLastUtterence.text, 
            transcript: edititedTranscript, 
            partsOfSpeech: watsonLastUtterence.partsOfSpeech,
            orderNLP: watsonLastUtterence.getOrderParts()
            });
            sendFinalResponse("Watson", responseToSend, client)

            if(typeof(client) == "object") {
                console.log("SENDING RESULTS");
                //sendFinalResponse("Google", JSON.stringify(returnResults));
                //client.sendUTF(JSON.stringify(returnResults));
            }

            } catch (e) {
                console.log(e);
            };
            
        }
    }
    if(name = "Data:") {

        //console.log(event);
        if(typeof(event) == "object") {
            return;
        }
        //console.log(recognizeStreamInterim);
        if(typeof(client) == "object")
            console.log(JSON.stringify(event, null, 4));
            //if(typeof(client.streams[Object.keys(client.streams)[0]]) == "object")
                //client.sendUTF(JSON.stringify({text: event}));
    }
    if(name = "Close:") {
        console.log("final stream closed");
        //client.close();
    }
};
var watsonLastUtterence;
function onInterimEvent(name, event, client) {
    if(!streamStarted)
        return
    //console.log(name);

    //console.log(JSON.stringify(event, null, 6));
    var returnText;
    if(name = "Results:") {
        
        //look for keywords here
        
            clearInterval(streamTimer);
            timeoutMS = 3000;
            streamTimout(client);
            clearInterval(serverTimer);
            serverTimeout();
        
    }
    if(name = "Data:") {
        //console.log("timer cleared", streamTimer)
        
        if(typeof(event) == "object") {
            return;
        }

        console.log(event);

        if(typeof(client) == "object" && typeof(event) == "string") {
            //console.log(client);
            if(typeof(client) == "object") {
                var currentUtterance = new utterance(event.trim(), nlu);
                watsonLastUtterence = currentUtterance;
                writeStream += currentUtterance.text;
                sessionWriteStream += currentUtterance.text;
                var responseToSend = JSON.stringify({sttSource: "Watson", 
                    sessionId: sessionId, 
                    lastUtterence: currentUtterance.text,
                    transcript: writeStream, 
                    partsOfSpeech: currentUtterance.partsOfSpeech,
                    orderNLP: currentUtterance.getOrderParts()
                    });
                sendFinalResponse("Watson", responseToSend, client)
                // client.sendUTF(JSON.stringify({sttSource: "Watson", 
                //     sessionId: sessionId, 
                //     lastUtterence: event, 
                //     transcript: writeStream, 
                //     partsOfSpeech: currentUtterance.partsOfSpeech,
                //     orderNLP: currentUtterance.orderParts
                // }));
                // currentUtterance.getSemanticRoles(function(err,response){
                //     if(!streamStarted)
                //     return;
                //     if (err) {
                //         console.log("error: ", err);
                //         responseToSend = JSON.stringify({sttSource: "Watson", 
                //         sessionId: sessionId, 
                //         lastUtterence: event, 
                //         transcript: writeStream, 
                //         partsOfSpeech: currentUtterance.partsOfSpeech,
                //         orderNLP: currentUtterance.orderParts
                //         });
                //         sendFinalResponse("Watson", responseToSend, client)
                //     }
                //     else {
                //         console.log("NLU Response");
                //         console.log(response);
                //         var responseToSend = JSON.stringify({sttSource: "Watson", 
                //             sessionId: sessionId, 
                //             lastUtterence: event, 
                //             transcript: writeStream, 
                //             partsOfSpeech: currentUtterance.partsOfSpeech,
                //             orderNLP: currentUtterance.orderParts,
                //             semanticRoles: response});
                //         sendFinalResponse("Watson", responseToSend, client)
                        
                //     }
                // });
                clearInterval(streamTimer);
                timeoutMS = 3000;
                streamTimout(client);
                //console.log(writeStream);
            }
        }
    }
    if(name = "Close:") {
        console.log("interim stream closed");
    }
};
function onGoogleEvent(name, event, client, sttObj) {
    if(!streamStarted)
        return
    //console.log(name);

    //console.log(JSON.stringify(event, null, 6));
    var returnText;
    if(name = "Results:") {
        
        //look for keywords here
        
            clearInterval(streamTimer);
            timeoutMS = 3000;
            streamTimout(client);
            clearInterval(serverTimer);
            serverTimeout();
        
    }
    if(name = "Data:") {
        //console.log("timer cleared", streamTimer)
        
        var data = event;

        //console.log(event);

        if(typeof(client) == "object") {
            
            //if(typeof(client.streams[Object.keys(client.streams)[0]]) == "object") {
                console.log(JSON.stringify(data));
                if(data.error != null || typeof(data.results) == "undefined" || data.results.length == 0)
                    return
                
                clearInterval(streamTimer);
                timeoutMS = 3000;
                streamTimout(client);

                if(data.results[0].isFinal) {
                    var currentUtterance = new utterance(data.results[0].alternatives[0].transcript.trim(), nlu);
                    
                    writeStreamGoogleFinal += currentUtterance.text;
                    writeStreamGoogle = writeStreamGoogleFinal;
                

                    //I want to send final results to a timer based function
                    //that waits for both streams to have final results
                    //before sending back a final response
                    //I'll use watson for sending back interim results for now.

                    var responseToSend = JSON.stringify({sttSource: "Google", 
                        sessionId: sessionId, 
                        lastUtterence: currentUtterance.text,
                        transcript: writeStreamGoogle, 
                        partsOfSpeech: currentUtterance.partsOfSpeech,
                        orderNLP: currentUtterance.orderParts
                    });
                    sendFinalResponse("Google", responseToSend, client);
                }
                else {
                    return
                }
                // currentUtterance.getSemanticRoles(function(err,response){
                //     if(!streamStarted)
                //         return;
                //     if (err) {
                //         console.log("nlu error: ", err);
                //         var responseToSend = JSON.stringify({sttSource: "Google", sessionId: sessionId, lastUtterence: data.results[0].alternatives[0].transcript, transcript: writeStreamGoogle, partsOfSpeech: currentUtterance.partsOfSpeech});
                //         sendFinalResponse("Google", responseToSend, client)
                //     }
                //     else {
                //         console.log("NLU Response");

                //         var responseToSend = JSON.stringify({sttSource: "Google", sessionId: sessionId, lastUtterence: data.results[0].alternatives[0].transcript, transcript: writeStreamGoogle, partsOfSpeech: currentUtterance.partsOfSpeech, semanticRoles: response});
                //         sendFinalResponse("Google", responseToSend, client);
                //         if(stopOnNextResultGoogle) {
                //             googleRecognizeStream.end();
                //         }
                //     }
                // });
                if(stopOnNextResultGoogle) {
                    sttObj.end();
                }
                console.log(writeStreamGoogle);
            //}
        }
    }
    if(name = "Close:") {
        console.log("google stream closed");
    }
};
var watsonFinal = null;
var googleFinal = null;
function scoreNLP(NLPArray) {
    var utterenceLength = NLPArray.length;
    var nonOrderWords = 0;
    var trimArray = []
    for(var i = 0; i < NLPArray.length; i++) {
        if (NLPArray[i][1] == "X")
            nonOrderWords++
        // else if(i == NLPArray.length - 1 && NLPArray[i][0] == "")
        //     trimArray.push[i];
    }

    var orderWordCount = NLPArray.length - nonOrderWords;

    return ((orderWordCount*100)/NLPArray.length)/100;

}

function sendFinalResponse(source, response, client) {
    if(source == "Google") {
        googleFinal = JSON.parse(response);
        googleFinal.orderScore = scoreNLP(googleFinal.orderNLP);
    }
    else {
        //stopOnNextResultGoogle = true;
        watsonFinal = JSON.parse(response);
        watsonFinal.orderScore = scoreNLP(watsonFinal.orderNLP);
    }

    if(!responseTriggered) {
        if(watsonFinal != null && googleFinal != null) {
            finalResponse(client);
            return
        }

        responseTimeout = setTimeout(function(){
            finalResponse(client);
            console.log("send time triggered");
            return;
        }, 2500);
    }
}
var responseTimeout;
var responseTriggered = false;
var responseTimeoutComplete = false;
var lastResponse;
function finalResponse(client) {
    clearTimeout(responseTimeout);
    //use a set timeout here to and group the responses
    //into a single final response to send.
    responseTriggered = true;
    responseTimeoutComplete = false;

    //this loop below makes it so I don't have to wait for the timer when the second response comes
    // while(watsonFinal == null || googleFinal == null) {
    //     console.log("in the while loop", responseTimeoutComplete);
    //     if(responseTimeoutComplete)
    //         break //timer wins and second response will be ommitted

    // }
    //console.log(client);
    //now either we have both responses or the timer expired and we have one
    var unifiedResponse = {};
    unifiedResponse.associatedRecording = associatedRecording + ".wav";
    unifiedResponse.sources = [];
    unifiedResponse.responseCount = 0;
    if(watsonFinal == null || googleFinal == null) {
        
        //only one response made it find out which one
        if(googleFinal == null) {
            //google didn't make the cutoff
            unifiedResponse.responseCount ++;
            unifiedResponse.sources.push(watsonFinal);
            //unifiedResponse.levenshteinDistance = watsonFinal.comparisonScore;
        }
        else {
            //watson didn't make the cutoff
            unifiedResponse.responseCount ++;
            unifiedResponse.sources.push(googleFinal);
        }
    }
    else {
        unifiedResponse.sources.push(watsonFinal);
        unifiedResponse.sources.push(googleFinal);
        unifiedResponse.responseCount = 2;
    }

    if(unifiedResponse.sources.length == 0)
        return

    if(googleFinal != null && watsonFinal != null)
        unifiedResponse.levenshteinDistance = natural.LevenshteinDistance(watsonFinal.lastUtterence, googleFinal.lastUtterence);
    

    unifiedResponse.sources.sort(function (a, b) {
        return b.orderScore - a.orderScore;
    });

    console.log(unifiedResponse);
    lastResponse = unifiedResponse;
    
    fileWriter.end();
    saveRecording(associatedRecording, JSON.stringify(unifiedResponse, null, 4));
    writefile();
    
    client.sendUTF(JSON.stringify(unifiedResponse));
    watsonFinal = null;
    googleFinal = null;

    responseTriggered = false;
    responseTimeoutComplete = false;
    //now I have to make the score for each
    // (matches*100)/totalWords)/100 = score

    //and then make a pretty unified response

    //sort the responses by score



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
        console.log('Successfully uploaded package.');

        s3.putObject({
            Bucket: bucket,
            Key: filepath + '.json',
            Body: response,
            ACL: 'public-read',
        },function (resp) {
            console.log(arguments);
            console.log('Successfully uploaded package.');
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
