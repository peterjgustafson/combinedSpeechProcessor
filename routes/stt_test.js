var express = require('express');
var router = express.Router();

router.get('/', function(req, res, next) {
  res.render('stt_test', {port: req.port});
});

module.exports = router;
