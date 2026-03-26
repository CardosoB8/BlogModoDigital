const bcrypt = require('bcrypt');

function isAuthenticated(req, res, next) {
  if (req.session.isAdmin) {
    next();
  } else {
    res.redirect('/admin/login');
  }
}

function checkAdminPassword(password) {
  return bcrypt.compareSync(password, process.env.ADMIN_PASSWORD_HASH || 
    bcrypt.hashSync(process.env.ADMIN_PASSWORD, 10));
}

module.exports = { isAuthenticated, checkAdminPassword };