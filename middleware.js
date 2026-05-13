const unauthorized_401 = 'Unauthorized! Please log in.';
const forbidden_403 = 'Forbidden! You do not have administrator privileges.';

function checkAuth(req, res, next) {
  if (!req.session.userID) {
	  return res.status(401).json({ error: unauthorized_401 });
  }
  next();
}

function isAdmin(req, res, next) {
  if (!req.session.userID) {
    return res.status(401).json({ error: unauthorized_401 });
  }
  if (req.session.role !== 'admin') {
    return res.status(403).json({ error: forbidden_403 });
  }
  next();
}

function canViewProfile(req, res, next) {
  const requestId = req.query.id;
  const sessionId = req.session.userID;
  if (requestId !== sessionId && req.session.role !== 'admin') {
    return res.status(403).json({ error: forbidden_403 });
  }
  next();
}

module.exports = { checkAuth, isAdmin, canViewProfile };
