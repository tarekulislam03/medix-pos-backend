import xss from 'xss';

const sanitizeMongo = (value) => {
  if (typeof value === 'string') {
    return value; // Do not strip dots and dollar signs from string values (corrupts data like "Dolo 6.25" or prices)
  }
  if (typeof value === 'object' && value !== null) {
    Object.keys(value).forEach(key => {
      if (key.startsWith('$') || key.includes('.')) {
        delete value[key];
      } else {
        value[key] = sanitizeMongo(value[key]);
      }
    });
  }
  return value;
};

const sanitizeXss = (value) => {
  if (typeof value === 'string') return xss(value);
  if (typeof value === 'object' && value !== null) {
    Object.keys(value).forEach(key => {
      value[key] = sanitizeXss(value[key]);
    });
  }
  return value;
};

const xssMiddleware = (req, res, next) => {
  if (req.body) {
    req.body = sanitizeXss(sanitizeMongo(req.body));
  }
  if (req.query) {
    Object.keys(req.query).forEach(key => {
      req.query[key] = sanitizeXss(sanitizeMongo(req.query[key]));
    });
  }
  if (req.params) {
    Object.keys(req.params).forEach(key => {
      req.params[key] = sanitizeXss(sanitizeMongo(req.params[key]));
    });
  }
  next();
};

export default xssMiddleware;  