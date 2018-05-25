
install dependencies:

    npm install
   
run:

    npm start

start a speech to text session:
http:{host}/stt/{sessionId}?clientId={clientId}

will return the port and sessionId

to connect to the newly instantiated session:
wss://{host}:{port}

to test the stt server in the browser
http:{host}/stt/test/{port}
    
    
