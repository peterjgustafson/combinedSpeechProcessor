const nlp = require('./vNLP').vNLP;

class NormalizedResponse {
    constructor(stt_source, utterance, transcript, sessionId) {
        var self = this;
        self.stt_source = stt_source;
        self.seesionId = sessionId;
        self.currentUtterance = new nlp(utterance.trim());
        self.transcript = transcript + self.currentUtterance.text;
        self.orderParts = self.currentUtterance.inferInents();

    }
    get response() {
        var self = this;
        return {sttSource: self.stt_source, 
        sessionId: self.sessionId, 
        lastUtterence: self.currentUtterance.text,
        transcript: self.transcript, 
        partsOfSpeech: self.currentUtterance.partsOfSpeech,
        orderNLP: self.orderParts.intents, 
        orderScore: self.orderParts.lexiconScore
        };
    }
}
module.exports = NormalizedResponse;