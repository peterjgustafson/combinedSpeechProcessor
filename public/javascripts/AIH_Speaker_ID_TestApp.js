


$(function () {
    console.log("doc ready");
    var client,
        recorder,
        context,
        bStream,
        contextSampleRate = (new AudioContext()).sampleRate;
        resampleRate = 16000,
        worker = new Worker('/javascripts/worker/resampler-worker.js');

    worker.postMessage({cmd:"init",from:contextSampleRate,to:resampleRate});

    worker.addEventListener('message', function (e) {
        if (client.readyState != "CLOSING" && client.readyState != "CLOSED")
            client.send(convertFloat32ToInt16(e.data.buffer));
    }, false);
    var clientPort;
    
    $("#stop-rec-btn").hide();
    $("#start-rec-btn").hide();
    var urlParams = new URLSearchParams(window.location.search);
    $.getJSON( "https://" + location.hostname + ":" + location.port + "/stt/?access_token=" + urlParams.get('access_token'), function( data ) {
            console.log("getPort");
            clientPort = data.port;

            $("#start-rec-btn").show();
            $("#stop-rec-btn").show();
            $("#stop-rec-btn").prop('disabled', true);
            document.getElementById("restult_text").innerHTML += "WS Connection opened on port: " + data.port;
            open(function(newClient){
                $("#stop-rec-btn").prop('disabled', false);
                console.log("new client");
                listen(newClient);
            });
        });
    $("#start-rec-btn").click(function () {

        
        $("#start-rec-btn").prop('disabled', true);

        if(!client || client.readyState == "CLOSED") {
            open(function(newClient){
                $("#stop-rec-btn").prop('disabled', false);
                console.log("new client");
                listen(newClient);
            });
        }
        else {

            $("#stop-rec-btn").prop('disabled', false);
        }
        // open(function(newClient){
        //     $("#stop-rec-btn").prop('disabled', false);
        //     console.log("new client");
        //     listen(newClient);
        // });
        // if(!client) {
        //     open(function(newClient){
        //         console.log("new client");
        //         listen(newClient);
        //     });
        // }
        // else {
        //     console.log(client);
        //     console.log(context);
        //     bStream = client.streams[0].write({sampleRate: resampleRate});
        //     listen(client);
        // }

        if (context) {
            recorder.connect(context.destination);
            return;
        }

        var session = {
            audio: true,
            video: false
        };


        navigator.getUserMedia(session, function (stream) {
            context = new AudioContext();
            var audioInput = context.createMediaStreamSource(stream);
            var bufferSize = 0; // let implementation decide

            recorder = context.createScriptProcessor(bufferSize, 1, 1);

            recorder.onaudioprocess = onAudio;

            audioInput.connect(recorder);

            recorder.connect(context.destination);

        }, function (e) {

        });
    });

    function onAudio(e) {
        var left = e.inputBuffer.getChannelData(0);

        worker.postMessage({cmd: "resample", buffer: left});

        drawBuffer(left);
    }

    function convertFloat32ToInt16(buffer) {
        var l = buffer.length;
        var buf = new Int16Array(l);
        while (l--) {
            buf[l] = Math.min(1, buffer[l]) * 0x7FFF;
        }
        return buf.buffer;
    }

    //https://github.com/cwilso/Audio-Buffer-Draw/blob/master/js/audiodisplay.js
    function drawBuffer(data) {
        var canvas = document.getElementById("canvas"),
            width = canvas.width,
            height = canvas.height,
            context = canvas.getContext('2d');

        context.clearRect (0, 0, width, height);
        var step = Math.ceil(data.length / width);
        var amp = height / 2;
        for (var i = 0; i < width; i++) {
            var min = 1.0;
            var max = -1.0;
            for (var j = 0; j < step; j++) {
                var datum = data[(i * step) + j];
                if (datum < min)
                    min = datum;
                if (datum > max)
                    max = datum;
            }
            context.fillRect(i, (1 + min) * amp, 1, Math.max(1, (max - min) * amp));
        }
    }

    $("#stop-rec-btn").click(function () {
        $("#start-rec-btn").prop('disabled', false);
        $("#stop-rec-btn").prop('disabled', true);
        //recorderClose();
        close();
    });

    function open(callback){
        console.log("open");

        window.WebSocket = window.WebSocket || window.MozWebSocket;
        
                if(!client || client.readyState !== client.OPEN){
                    client = new WebSocket('wss://' + location.hostname + ":" + clientPort, urlParams.get('access_token'));
                    client.binaryType = "arraybuffer";
                    client.onopen = function () {
                        
                        callback(client);    
                   // connection is opened and ready to use
                 };
        
                 client.onerror = function (error) {
                   // an error occurred when sending/receiving data
                 };
        
                 client.onmessage = function (message) {
                   console.log(message);
                   transcript.text(message.data);
                 };

                 client.onclose = function () {
                    console.log("close event");
                    close();
                 };
               }

    }

    function listen(client){
        client.onmessage = function (message) {
            console.log(message.data);
            if(typeof(message.data) == "object")
                data = message.data;
            else
                data = JSON.parse(message.data);
                //these are the speech recognition results being sent back from the ws connection
                if(data.transcript) {
                    if(data.sttSource == "Watson")
                        document.getElementById("transcriptWatson").innerHTML = data.transcript;
                    else
                        document.getElementById("transcriptGoogle").innerHTML = data.transcript;
                }
                if(data.semanticRoles) {
                    if(data.sttSource == "Watson") {
                        document.getElementById("semanticRolesWatson").innerHTML = "";
                        var semanticsListWatson = document.createElement('ul');
                        for(var i = 0; i < data.semanticRoles.semantic_roles.length; i++) {
                            // Create the list item:
                            var item = document.createElement('li');
                    
                            // Set its contents:
                            item.appendChild(document.createTextNode(JSON.stringify(data.semanticRoles.semantic_roles[i])));
                    
                            // Add it to the list:
                            semanticsListWatson.appendChild(item);
                        }
                        document.getElementById("semanticRolesWatson").appendChild(semanticsListWatson);
                    }
                    else {
                        document.getElementById("semanticRolesGoogle").innerHTML = "";
                        var semanticsList = document.createElement('ul');
                        for(var i = 0; i < data.semanticRoles.semantic_roles.length; i++) {
                            // Create the list item:
                            var item = document.createElement('li');
                    
                            // Set its contents:
                            item.appendChild(document.createTextNode(JSON.stringify(data.semanticRoles.semantic_roles[i])));
                    
                            // Add it to the list:
                            semanticsList.appendChild(item);
                        }
                        document.getElementById("semanticRolesGoogle").appendChild(semanticsList);
                    }
                }
                if(data.partsOfSpeech) {
                    if(data.sttSource == "Watson") {
                        document.getElementById("posWatson").innerHTML = "";
                        var posListWatson = document.createElement('ul');
                        for(var i = 0; i < data.partsOfSpeech.length; i++) {
                            // Create the list item:
                            var item = document.createElement('li');
                    
                            // Set its contents:
                            item.appendChild(document.createTextNode(JSON.stringify(data.partsOfSpeech[i])));
                    
                            // Add it to the list:
                            posListWatson.appendChild(item);
                        }
                        document.getElementById("posWatson").appendChild(posListWatson);
                    }
                    else {
                        document.getElementById("posGoogle").innerHTML = "";
                        var posList = document.createElement('ul');
                        for(var i = 0; i < data.partsOfSpeech.length; i++) {
                            // Create the list item:
                            var item = document.createElement('li');
                    
                            // Set its contents:
                            item.appendChild(document.createTextNode(JSON.stringify(data.partsOfSpeech[i])));
                    
                            // Add it to the list:
                            posList.appendChild(item);
                        }
                        document.getElementById("posGoogle").appendChild(posList);
                    }
                }
                if(data.orderParts) {
                    if(data.sttSource == "Watson") {
                        document.getElementById("orderWatson").innerHTML = "";
                        var orderListWatson = document.createElement('ul');
                        for(var i = 0; i < data.orderParts.length; i++) {
                            // Create the list item:
                            var item = document.createElement('li');
                    
                            // Set its contents:
                            item.appendChild(document.createTextNode(JSON.stringify(data.orderParts[i])));
                    
                            // Add it to the list:
                            orderListWatson.appendChild(item);
                        }
                        document.getElementById("orderWatson").appendChild(orderListWatson);
                    }
                    else {
                        document.getElementById("orderGoogle").innerHTML = "";
                        var orderList = document.createElement('ul');
                        for(var i = 0; i < data.orderParts.length; i++) {
                            // Create the list item:
                            var item = document.createElement('li');
                    
                            // Set its contents:
                            item.appendChild(document.createTextNode(JSON.stringify(data.orderParts[i])));
                    
                            // Add it to the list:
                            orderList.appendChild(item);
                        }
                        document.getElementById("orderGoogle").appendChild(orderList);
                    }
                }
                if(data.lastUtterence) {
                    if(data.sttSource == "Watson")
                    document.getElementById("lastUtterenceWatson").innerHTML = data.lastUtterence;
                else
                    document.getElementById("lastUtterenceGoogle").innerHTML = data.lastUtterence;
                }
                    

                if(data.speakerData) {
                    if(data.speakerData.resultsType == "final") {//keywords
                        
                        recorderClose();
                    }
                    
                    document.getElementById("keywords").innerHTML = "";
                    document.getElementById("speakers").innerHTML = "";
                    console.log(data.speakerData);
                    var speakerData = "";
                    for (var sd = 0; sd < data.speakerData.length; sd++)
                        {
                            if(data.speakerData[sd].keyword_result) {
                                    document.getElementById("keywords").innerHTML += "<speakerLabel>Speaker ";
                                    document.getElementById("keywords").innerHTML += data.speakerData[sd].speaker;
                                    document.getElementById("keywords").innerHTML += ":&nbsp;</speakerLabel>";
                                data.speakerData[sd].keyword_result.forEach(function(keyword, index){
                                    document.getElementById("keywords").innerHTML += keyword;
                                    console.log(index);
                                    if(index != data.speakerData[sd].keyword_result.length - 1)
                                        document.getElementById("keywords").innerHTML += ", ";
                                });
                                    document.getElementById("keywords").innerHTML += "<br>";
                            }
                            document.getElementById("speakers").innerHTML += "<speakerLabel>Speaker ";
                            document.getElementById("speakers").innerHTML += data.speakerData[sd].speaker;
                            document.getElementById("speakers").innerHTML += ":&nbsp;</speakerLabel>";
                            document.getElementById("speakers").innerHTML += data.speakerData[sd].text;
                            document.getElementById("speakers").innerHTML += "<br>";

                            


                        }
                    }

                document.getElementById("restult_text").innerHTML += "\n\n" + JSON.stringify(data);
                console.log(message);
            
            
        };
    }

    function recorderClose(){
        console.log('recorder close');
        if(recorder)
            recorder.disconnect();
    }

    function close(){
        console.log('close');
        if(recorder)
            recorder.disconnect();
        if(client)
            client.close();
    }
});

navigator.getUserMedia = navigator.getUserMedia ||
    navigator.webkitGetUserMedia ||
    navigator.mozGetUserMedia ||
    navigator.msGetUserMedia;