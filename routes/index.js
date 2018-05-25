var express = require('express');
var router = express.Router();


/* GET home page. */
router.get('/', function(req, res, next) {

    res.send({ status: "OK", message: "Speech-Processor" });
    
});

module.exports = router;
