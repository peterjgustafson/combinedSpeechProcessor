
var watson = require('watson-developer-cloud');
var natural = require('natural');
var path = require("path");
const keywords = require("./keywords");
const base_folder = path.join(path.dirname(require.resolve("natural")), "brill_pos_tagger");
const rulesFilename = base_folder + "/data/English/tr_from_posjs.txt";
const lexiconFilename = base_folder + "/data/English/lexicon_from_posjs.json";
const defaultCategory = 'N';
const lexicon = new natural.Lexicon(lexiconFilename, defaultCategory);
const rules = new natural.RuleSet(rulesFilename);
var tagger = new natural.BrillPOSTagger(lexicon, rules);
const orderLexicon = new natural.Lexicon(path.join(__dirname, "order-parts-rose.json"), "X");
const orderRules = new natural.RuleSet(path.join(__dirname, "rules.txt"));
var orderTagger = new natural.BrillPOSTagger(orderLexicon, orderRules);


class Utterance {
    constructor(text, nlu = null) {
        var self = this;
        self.fixText(text.toLowerCase().trim());
        self.nlu = nlu;
        self.textSplit = self.text.split(" ");
        
        self.partsOfSpeech = tagger.tag(self.textSplit);

        self.orderParts = self.getOrderParts();
        
    }
    fixText(text) {
        //console.log("text to fix: ", text)
        var self = this;
        var find = ["cheese burger", "%HESTITATION", "to", "for", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen"];
        var rep = ["cheeseburger", "", 2, 4, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
        var sentence = text.split(" ");
        for(var i = 0; i < sentence.length; i++) {
            if(find.indexOf(sentence[i]) > -1)
                sentence[i] = rep[find.indexOf(sentence[i])];
        }

        
        var reassembledSentence = sentence.slice(0, sentence.length).join(' ') + " ";
        self.text = reassembledSentence
        //console.log("fixed text: ", reassembledSentence)
        //return reassembledSentence
    }
    getSemanticRoles(callback) {
        var self = this;
        var parameters = {
            'features': {
                'semantic_roles': {}
            },
            'text': self.text
        };
        self.nlu.analyze(parameters, function (err, response) {
            if (err)
                callback(err, null);
            else
                callback(null, response);
        });
    }
    getOrderParts() {
        var self = this;
        var text = self.text.trim();
        for(var keyword = 0; keyword < keywords.length; keyword++) {
            if(text.indexOf(keywords[keyword].toLowerCase()) > -1) {
                var currentKeyword = keywords[keyword].replace(/\s+/g, "-").toLowerCase();
                text = text.replace(keywords[keyword].toLowerCase(), currentKeyword);
                console.log("keyword found: ", currentKeyword);
            }
        }

        var sentence = text.split(" ");
        // sentence = text.split(" ");
        // sentence = text.split(" ");
        
        
        //console.log(JSON.stringify(tagger.tag(sentence)));
        //console.log(text);
        var taggedSentence = orderTagger.tag(sentence);
        //console.log("Order Tagger", taggedSentence[0]);
        var last_item;
        var last_action;
        var last_qty;
        for (var i = 0; i < taggedSentence.length; i++) {
            // is a cancel word detected
            //console.log(taggedSentence[i][1]);
            if(taggedSentence[i][1] == "REMOVE_FROM_ORDER")
                console.log("Action: Cancel Item");
        
            if(taggedSentence[i][1] == "ADD_TO_ORDER")
                console.log("Action: Add Item");
        
            if(i != 0) {
                if(taggedSentence[i][1] == "QTY" && taggedSentence[i-1][1] != "REMOVE_FROM_ORDER" && taggedSentence[i-1][1] != "ADD_TO_ORDER")
                    console.log("Action: Add Item", "QTY: ", taggedSentence[i][0]);
                else if (taggedSentence[i][1] == "QTY")
                    console.log("Action: Add Item");
            }
            else if(taggedSentence[i][1] == "QTY") {
                console.log("Action: Add Item", "QTY: ", taggedSentence[i][0]);
            }
        }
        
        //console.log('output');
        var score = self.scoreNLP(taggedSentence);
        var results = {taggedSentence: taggedSentence, orderScore: score};
        console.log(JSON.stringify(results));

        return results; 

    

    }
    scoreNLP(NLPArray) {
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
}

exports.Utterance = module.exports.Utterance = Utterance;