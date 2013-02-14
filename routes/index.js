
/*
 * GET home page.
 */
exports.index = function(req, res){
  res.render('index', {
    title: 'Suzuri',
    user: req.user,
    conf: conf
  });
};